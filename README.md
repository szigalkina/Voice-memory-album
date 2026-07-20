# Voice Memory Album

The moments you love, told in your own voice.

**Live:** https://voice-memory-album.vercel.app

A mobile-first web app: tap one button, talk about your baby's day — or any moment
worth keeping — in any language,
and AI turns the voice note into a page of a quietly luxurious photo book — title,
message in a handwritten script, milestone detection, and a place for photos. The
album grows from the very first entry and exports as a print-ready PDF.

## Features

- **Voice-first journaling** — browser recording with a live waveform; Gemini
  transcribes and writes each entry in the language you spoke (mocked locally)
- **The book** — swipeable paper pages, one entry per page, handwritten style
  (Cyrillic-capable), month-of-life chapters, uniform date placement
- **Editing** — every page: title, message, add/remove photos; editable album
  title (tap the cover title)
- **Multiple albums** per account, with an account page to switch between them
- **Sharing** — revocable view-only links for family; no account needed to view
- **Print export** — 21×21 cm PDF (full, pages-only, or cover-only) for
  PDF-accepting printers like Blurb, PrestoPhoto, Mixam
- **Private by design** — private blob storage behind an authenticated,
  per-family media gateway; scrypt passwords; rate limiting; no trackers

## Local development — zero configuration

```bash
npm install
npm run dev
```

With no environment variables the app is fully self-contained: embedded Postgres
(PGlite in `.data/`), disk file storage, deterministic mock AI, and on-screen
reset links. `npm test` runs the unit suite.

## Production

Each env var flips one subsystem from its local fallback to the real service
(see `.env.example`): `DATABASE_URL` (Neon), `BLOB_READ_WRITE_TOKEN` (private
Vercel Blob store), `GEMINI_API_KEY` + `GEMINI_MODEL` (real AI), `RESEND_API_KEY`
(password-reset + support emails), `AUTH_SECRET`, `APP_URL`.

Deploy: `npx vercel deploy --prod`.

## Architecture notes

- One swappable module per concern: `lib/ai.ts` (AI provider), `lib/storage.ts`
  (files), `lib/db.ts` (database, `globalThis` singleton), `lib/book.ts` (album
  page layout — unit-tested), `lib/pdf.tsx` (print rendering)
- Raw transcripts and audio are always stored; entries can be reprocessed
- AI failures mark entries `failed` with retry — a recording is never lost
- Design system ("Atelier"): `DESIGN.md`; product context: `PRODUCT.md`
- Operating manual and prescriptive roadmap for future work: `docs/ROADMAP.md`
