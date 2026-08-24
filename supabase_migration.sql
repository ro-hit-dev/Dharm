-- Run this in Supabase SQL Editor for a database created from scratch.
-- If you already created the earlier tables, use the ALTER statements below
-- and keep your existing RLS policies.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  age integer,
  language text not null default 'en' check (language in ('en','hi','mr')),
  created_at timestamptz not null default now()
);

create table if not exists public.day_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day integer not null check (day between 1 and 142),
  best_score integer not null default 0 check (best_score between 0 and 10),
  attempts integer not null default 0 check (attempts >= 0),
  completed_at timestamptz,
  first_completed_at timestamptz,
  unique (user_id, day)
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day integer not null check (day between 1 and 142),
  score integer not null check (score between 0 and 10),
  completed_at timestamptz not null default now()
);

alter table public.day_progress add column if not exists first_completed_at timestamptz;

alter table public.profiles enable row level security;
alter table public.day_progress enable row level security;
alter table public.quiz_attempts enable row level security;

-- Re-runnable policy creation is easiest with explicit drops.
drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Users can create their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can view their own progress" on public.day_progress;
drop policy if exists "Users can create their own progress" on public.day_progress;
drop policy if exists "Users can update their own progress" on public.day_progress;
drop policy if exists "Users can view their own attempts" on public.quiz_attempts;
drop policy if exists "Users can create their own attempts" on public.quiz_attempts;

create policy "Users can view their own profile" on public.profiles
for select to authenticated using (auth.uid() = id);

create policy "Users can create their own profile" on public.profiles
for insert to authenticated with check (auth.uid() = id);

create policy "Users can update their own profile" on public.profiles
for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users can view their own progress" on public.day_progress
for select to authenticated using (auth.uid() = user_id);

create policy "Users can create their own progress" on public.day_progress
for insert to authenticated with check (auth.uid() = user_id);

create policy "Users can update their own progress" on public.day_progress
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can view their own attempts" on public.quiz_attempts
for select to authenticated using (auth.uid() = user_id);

create policy "Users can create their own attempts" on public.quiz_attempts
for insert to authenticated with check (auth.uid() = user_id);
