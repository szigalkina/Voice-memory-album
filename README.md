# Voice Baby Album 🎙️

Your baby's first year, told in your own voice.

A mobile-first web app (PWA): tap one big button, talk about your baby's day in any
language, and AI turns the voice note into a titled, summarized journal entry — with
milestone detection, a pull-quote in your own words, and a friendly nudge to add a
photo of the moment. A living **album** grows automatically from the very first entry,
organized by month of life, and you curate which entries belong in it.

## Local development — zero configuration

```bash
npm install
npm run dev
```

That's it. With no environment variables set, the app runs fully self-contained:

| Concern | Local dev fallback |
|---|---|
| Database | Embedded Postgres (PGlite) persisted to `.data/pglite` |
| Audio & photo storage | Local disk under `.data/uploads` |
| AI processing | Deterministic mock (always "First big laugh") |
| Magic-link email | Link is shown directly on the sign-in screen |

Tests: `npm test` · Build: `npm run build`

## Production

Copy `.env.example` and set the variables — each one flips a subsystem from its dev
fallback to the real service:

- `DATABASE_URL` → Neon Postgres
- `BLOB_READ_WRITE_TOKEN` → Vercel Blob (files stored at original resolution)
- `GEMINI_API_KEY` → Gemini Flash: transcription + structured summary in one call
  (free tier is plenty for personal use)
- `RESEND_API_KEY` → real magic-link emails
- `AUTH_SECRET`, `APP_URL` → session signing and canonical link URL

Deploy: `vercel deploy` (Next.js App Router, no special configuration).

## Architecture notes

- `lib/ai.ts` owns the AI provider — swap Gemini for anything else in one file.
  Raw transcript and audio are always stored, so entries can be reprocessed.
- `lib/months.ts` computes "Month N of life" buckets (the album's page structure —
  designed to map onto a printable photo book later).
- AI processing runs synchronously inside the entry-creation request; failures mark
  the entry `failed` with a retry button. A recording is never lost.
- Design spec and implementation plan live in `docs/superpowers/`.
