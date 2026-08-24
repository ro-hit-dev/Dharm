-- Dharma Quest: existing Supabase schema verification.
-- READ-ONLY. Run this before/after the migration to inspect the current schema.

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('profiles', 'day_progress', 'quiz_attempts', 'quiz_attempt_answers')
order by table_name;

select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles', 'day_progress', 'quiz_attempts', 'quiz_attempt_answers')
order by table_name, ordinal_position;

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'day_progress', 'quiz_attempts', 'quiz_attempt_answers')
order by tablename;

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'finalize_quiz_attempt';

-- Duplicate check for the aggregate progress table:
select user_id, day, count(*)
from public.day_progress
group by user_id, day
having count(*) > 1;
