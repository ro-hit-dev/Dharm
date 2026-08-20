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
