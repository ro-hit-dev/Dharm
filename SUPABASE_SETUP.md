# Dharma Quest — Supabase Update Guide

This update adds permanent question-by-question test history.

## Existing tables you already have

- `profiles`
- `day_progress`
- `quiz_attempts`

Do **not** delete those tables.

## New table

`quiz_attempt_answers` stores a snapshot of every answer from every completed test.

That allows the application to show:

- which attempt was taken
- the score
- every question
- the user's selected answer
- the correct answer
- whether the answer was correct
- the explanation at the time the test was taken

The question text and explanation are intentionally snapshotted. If you edit the question later, an old test still shows what the user actually saw.

## Run the migration

1. Open Supabase.
2. Open **SQL Editor**.
3. Create a new query.
4. Copy the complete contents of `supabase_migration.sql` into it.
5. Run it once.

The migration:

1. Adds attempt metadata to `quiz_attempts`.
2. Backfills existing attempt metadata where possible.
3. Creates a unique `(user_id, day)` index for `day_progress`.
4. Creates `quiz_attempt_answers`.
5. Adds RLS policies for user-owned attempts and answers.
6. Creates the `finalize_quiz_attempt(...)` RPC.
7. Grants that RPC only to authenticated users.

## Important: duplicate progress check

The unique index will fail if `day_progress` currently contains multiple rows for the same user/day.

Before running the migration, you can check with:

```sql
select user_id, day, count(*)
from public.day_progress
group by user_id, day
having count(*) > 1;
```

If this returns zero rows, the unique index should be safe.

## What the new database flow does

When a signed-in user finishes a test:

```text
React
  ↓
finalize_quiz_attempt RPC
  ↓
quiz_attempts
  ↓
quiz_attempt_answers (one row per question)
  ↓
day_progress aggregate update
```

The RPC runs inside one PostgreSQL transaction. If one part fails, the complete operation rolls back.

## Existing historical attempts

Old `quiz_attempts` rows can keep their score/history metadata, but they do not magically contain the answers that were never stored before this migration.

Therefore:

- new attempts after this migration have full question-by-question review;
- older attempts can show their score but may display that detailed answers were not stored.

## RLS expectation

A signed-in user should be able to read only their own:

- profile
- day progress
- quiz attempts
- quiz attempt answers

Never expose the service-role key to the browser.

## After migration

Deploy the updated React application. No new Cloudflare environment variables are required for this feature because it uses the same Supabase URL and publishable key already configured in Cloudflare.
