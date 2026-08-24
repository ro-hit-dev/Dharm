-- Dharma Quest: existing Supabase schema verification.
-- This file is intentionally READ-ONLY. Run it in the Supabase SQL editor
-- to inspect the existing tables before making any schema changes.

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('profiles', 'day_progress', 'quiz_attempts')
order by table_name;

select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles', 'day_progress', 'quiz_attempts')
order by table_name, ordinal_position;

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'day_progress', 'quiz_attempts')
order by tablename;
