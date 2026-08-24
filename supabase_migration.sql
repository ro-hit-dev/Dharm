-- Dharma Quest: historical quiz review + attempt history
-- Run this ONCE in Supabase SQL Editor after reviewing your existing schema.
-- It extends the existing tables; it does not create a second progress system.

begin;

-- 1) Extend quiz_attempts so every attempt has enough metadata to review it later.
alter table public.quiz_attempts
  add column if not exists attempt_number integer,
  add column if not exists total_questions integer,
  add column if not exists percentage numeric(5,2),
  add column if not exists started_at timestamptz;

-- Backfill existing attempt rows where possible.
with numbered as (
  select
    id,
    row_number() over (partition by user_id, day order by completed_at, id) as rn
  from public.quiz_attempts
)
update public.quiz_attempts q
set
  attempt_number = coalesce(q.attempt_number, n.rn),
  total_questions = coalesce(q.total_questions, 10),
  percentage = coalesce(q.percentage, q.score * 10),
  started_at = coalesce(q.started_at, q.completed_at)
from numbered n
where q.id = n.id;

alter table public.quiz_attempts
  alter column attempt_number set default 1,
  alter column total_questions set default 0,
  alter column percentage set default 0;

-- 2) One aggregate row per user/day.
-- Run the duplicate check shown below first if this unique index fails.
create unique index if not exists day_progress_user_day_uidx
  on public.day_progress(user_id, day);

-- 3) Store a snapshot of every answer in every completed test.
create table if not exists public.quiz_attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  day integer not null,
  question_number integer not null,
  question_text text not null,
  selected_text text not null,
  correct_text text not null,
  is_correct boolean not null,
  explanation text not null default '',
  created_at timestamptz not null default now(),
  unique (attempt_id, question_number)
);

create index if not exists quiz_attempt_answers_attempt_idx
  on public.quiz_attempt_answers(attempt_id, question_number);

create index if not exists quiz_attempt_answers_user_day_idx
  on public.quiz_attempt_answers(user_id, day, question_number);

-- 4) Enable RLS.
alter table public.quiz_attempts enable row level security;
alter table public.day_progress enable row level security;
alter table public.profiles enable row level security;
alter table public.quiz_attempt_answers enable row level security;

-- 5) Replace/standardize user-owned policies without disturbing unrelated policies.
drop policy if exists "dq_read_own_quiz_attempts" on public.quiz_attempts;
drop policy if exists "dq_insert_own_quiz_attempts" on public.quiz_attempts;
drop policy if exists "dq_read_own_day_progress" on public.day_progress;
drop policy if exists "dq_insert_own_day_progress" on public.day_progress;
drop policy if exists "dq_update_own_day_progress" on public.day_progress;
drop policy if exists "dq_read_own_quiz_answers" on public.quiz_attempt_answers;
drop policy if exists "dq_insert_own_quiz_answers" on public.quiz_attempt_answers;


create policy "dq_read_own_quiz_attempts"
on public.quiz_attempts
for select
to authenticated
using (auth.uid() = user_id);

create policy "dq_insert_own_quiz_attempts"
on public.quiz_attempts
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "dq_read_own_day_progress"
on public.day_progress
for select
to authenticated
using (auth.uid() = user_id);

create policy "dq_insert_own_day_progress"
on public.day_progress
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "dq_update_own_day_progress"
on public.day_progress
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "dq_read_own_quiz_answers"
on public.quiz_attempt_answers
for select
to authenticated
using (auth.uid() = user_id);

create policy "dq_insert_own_quiz_answers"
on public.quiz_attempt_answers
for insert
to authenticated
with check (auth.uid() = user_id);

-- 6) Atomic completion function.
-- The browser calls this RPC instead of separately inserting an attempt,
-- inserting answers, and updating day_progress. If any part fails, the whole
-- function rolls back.
create or replace function public.finalize_quiz_attempt(
  p_day integer,
  p_score integer,
  p_total_questions integer,
  p_answers jsonb,
  p_started_at timestamptz default now(),
  p_completed_at timestamptz default now()
)
returns public.day_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt_id uuid;
  v_attempt_number integer;
  v_first_completed_at timestamptz;
  v_best_score integer;
  v_progress public.day_progress%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_day < 1 then
    raise exception 'Invalid day';
  end if;

  if p_total_questions < 1 then
    raise exception 'Invalid question count';
  end if;

  if p_score < 0 or p_score > 10 then
    raise exception 'Invalid score';
  end if;

  if jsonb_typeof(p_answers) <> 'array' then
    raise exception 'Answers must be a JSON array';
  end if;

  select coalesce(max(attempt_number), 0) + 1
  into v_attempt_number
  from public.quiz_attempts
  where user_id = v_user_id
    and day = p_day;

  insert into public.quiz_attempts (
    user_id,
    day,
    score,
    total_questions,
    percentage,
    attempt_number,
    started_at,
    completed_at
  )
  values (
    v_user_id,
    p_day,
    p_score,
    p_total_questions,
    round((p_score::numeric / p_total_questions::numeric) * 100, 2),
    v_attempt_number,
    p_started_at,
    p_completed_at
  )
  returning id into v_attempt_id;

  insert into public.quiz_attempt_answers (
    attempt_id,
    user_id,
    day,
    question_number,
    question_text,
    selected_text,
    correct_text,
    is_correct,
    explanation
  )
  select
    v_attempt_id,
    v_user_id,
    p_day,
    (item->>'question_number')::integer,
    item->>'question_text',
    item->>'selected_text',
    item->>'correct_text',
    coalesce((item->>'is_correct')::boolean, false),
    coalesce(item->>'explanation', '')
  from jsonb_array_elements(p_answers) as item;

  insert into public.day_progress (
    user_id,
    day,
    best_score,
    attempts,
    completed_at,
    first_completed_at
  )
  values (
    v_user_id,
    p_day,
    p_score,
    1,
    p_completed_at,
    p_completed_at
  )
  on conflict (user_id, day)
  do update set
    best_score = greatest(public.day_progress.best_score, excluded.best_score),
    attempts = coalesce(public.day_progress.attempts, 0) + 1,
    completed_at = excluded.completed_at,
    first_completed_at = least(
      coalesce(public.day_progress.first_completed_at, excluded.first_completed_at),
      excluded.first_completed_at
    );

  select *
  into v_progress
  from public.day_progress
  where user_id = v_user_id
    and day = p_day;

  return v_progress;
end;
$$;

revoke all on function public.finalize_quiz_attempt(integer, integer, integer, jsonb, timestamptz, timestamptz) from public;
grant execute on function public.finalize_quiz_attempt(integer, integer, integer, jsonb, timestamptz, timestamptz) to authenticated;

commit;

-- Diagnostic: if the unique index above fails, find duplicate progress rows:
-- select user_id, day, count(*)
-- from public.day_progress
-- group by user_id, day
-- having count(*) > 1;
