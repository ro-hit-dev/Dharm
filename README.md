# Dharma Quest — React + Vite

Converted from `Dharma Quest_Quiz v3.html` into a proper React + TypeScript + Vite project.

## Included

- React + TypeScript + Vite structure
- Existing 7-day Ārambhaka quiz content
- Existing English/Hindi/Marathi UI labels
- Local browser persistence for profile and day scores
- Sequential daily unlock logic at 06:00 IST
- Correct final-question scoring
- Correct progress-bar calculation
- Responsive CSS
- No phone-number collection in this version

> The original v3 data mirrors the English quiz questions into Hindi/Marathi. The UI translations are preserved, but the question bank itself is still English and should be translated separately before presenting the app as fully multilingual.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Production build

```bash
npm run build
npm run preview
```

The generated production files are in `dist/`.

## Deploy on Cloudflare Pages

Build command:

```bash
npm run build
```

Output directory:

```text
dist
```

You can connect the GitHub repository to Cloudflare Pages for automatic deployments.

## Next architecture step

For accounts, cross-device progress, and database-backed history, add Supabase Auth + PostgreSQL after this frontend is stable.

## Repaired build notes

This version fixes the main runtime issues in the original prototype:

- Guest onboarding works without forcing the authentication screen.
- The Sign In action now renders the authentication screen correctly.
- The final quiz answer is included in the calculated score and saved review.
- Supabase configuration is optional; missing environment variables no longer crash the app.
- Supabase auth state is strongly typed and safely handled.
- Local storage is guarded against malformed JSON, unavailable storage, and legacy-state migration.
- Day unlock/retest logic remains based on 06:00 IST and first completion dates.

### Environment

For account authentication, provide:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Without these variables, the app still runs in guest mode.

## Deployment notes

- Cloudflare Pages build: `pnpm build`
- Build output: `dist`
- Required client environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
- Do not commit `.env.local` or any Supabase secret/service-role key.
- `supabase_schema_check.sql` is read-only and is provided to verify the existing `profiles`, `day_progress`, and `quiz_attempts` schema before changing the database.

## Test history and review

Authenticated users now have permanent online quiz history. Each completed attempt is stored in `quiz_attempts`, while each question/answer pair is stored in `quiz_attempt_answers`. The app can therefore show previous attempts and question-by-question review. `day_progress` remains the aggregate progression record.

Run `supabase_migration.sql` once in the Supabase SQL Editor before using the new online test-history feature.
