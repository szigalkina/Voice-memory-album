# Voice Baby Journal — Design Spec

**Date:** 2026-07-11
**Status:** Approved by user (conversation, 2026-07-11)

## What it is

A mobile-first web app (PWA) for journaling a child's first year by voice. A parent
records short voice notes on their phone; AI transcribes and summarizes each note,
detects milestones, and prompts for photos. The app builds a living album — a
scrollable timeline of the first year — automatically, starting from the very first
entry.

## Core decisions (settled with user)

| Decision | Choice |
|---|---|
| Channel | Mobile-first web app (PWA), designed entirely around phone use. No native app, no messenger bot. |
| Album form | Living timeline in the app, grouped by baby's month. Live from the first entry, grows with each record. |
| Accounts | One parent account, one child. Email magic-link sign-in. Journal is private to the account. |
| Photo prompt | After **every** entry, AI shows its summary and asks "Got a photo of this moment?" — skippable. Photos attach to entries whether or not they're milestones. |
| Album membership | AI suggests: milestone entries default into the album, everyday entries stay in the log. Every entry has a toggle to add/remove it from the album at any time. Entries can also be edited or deleted. |
| Print path | Digital product only, but structured to be print-exportable later (see Print-readiness). No print service integration. |
| AI provider | Google Gemini Flash via free API tier — one call handles audio transcription + structured summary. Wrapped in a swappable module. |

## User experience

- **Journal screen (home):** one big record button. Tap to record a voice note in any
  language, tap to stop. The entry appears immediately in a "thinking" state while AI
  processes it.
- **AI response:** within seconds the entry shows a title, a short summary in the
  language spoken, a quote pulled from the parent's own words, a milestone badge if
  detected, and a friendly photo prompt with an add-photos button (camera or gallery).
  Skippable.
- **Album screen (timeline):** scrollable timeline grouped by the baby's month
  ("Month 3 — March"). Shows album entries: title, summary, quote, photos. A "show
  everything" toggle reveals the full log including everyday entries.
- **Entry controls:** in-album toggle, edit (fix the AI's summary/title), delete,
  add/remove photos.
- **Onboarding:** after magic-link sign-in, one screen asks for the baby's name and
  birth date (needed to compute "Month N"). That's the entire setup.

## Architecture

Single Next.js (App Router) app deployed on Vercel — frontend and API routes in one
codebase.

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router), mobile-first PWA (web manifest, installable) |
| Database | Neon Postgres (Vercel Marketplace) |
| File storage | Vercel Blob — audio recordings and photos, stored at original resolution |
| Auth | Email magic-link (e.g. Auth.js email provider), single-user accounts |
| AI | Gemini Flash via free API tier, one module (`lib/ai.ts`) owning the provider so it can be swapped later |
| Recording | Browser MediaRecorder API — no library, no cost |

## AI pipeline

One API route handles a finished recording:

1. Client uploads the audio blob.
2. Server sends audio to Gemini Flash in a single call requesting structured JSON:
   `{ title, summary, quote, is_milestone, milestone_type, photo_prompt }` — written
   in the same language the parent spoke.
3. Result is stored on the entry alongside the raw transcript and the audio URL, so
   nothing is lost and summaries can be regenerated later (or by a different provider).

Failure handling: if the AI call fails, the entry is saved with the audio and marked
"processing failed" with a retry button — a recording is never lost.

## Data model

```
users    (id, email, created_at)
babies   (id, user_id, name, birthdate)
entries  (id, baby_id, recorded_at, audio_url, transcript,
          title, summary, quote, is_milestone, milestone_type,
          in_album, status [processing|ready|failed])
photos   (id, entry_id, blob_url, created_at)
```

`in_album` defaults to `is_milestone` when AI processing completes; the user can flip
it any time. "Month N" is computed from `recorded_at` minus `babies.birthdate` — not
stored.

## Print-readiness (design constraint now, feature later)

- Album is structured as **month sections containing ordered entries** — maps directly
  onto photo-book pages.
- Photos stored at original resolution, never downscaled — print quality preserved.
- v2 feature: "Export for print" renders the album as a print-ready PDF at a standard
  square photo-book size (21×21 cm, 300 DPI, with bleed) that the user uploads to
  Albelli or any similar service themselves. No print API integration is built or
  planned. Nothing in v1 blocks this.

## Error handling

- Recording: handle mic-permission denial with clear guidance; warn on unsupported
  browsers.
- Upload: retry on network failure; audio kept client-side until upload confirms.
- AI: failed processing marks entry `failed` with retry; raw audio always preserved.
- Auth: expired magic links get a friendly re-send screen.

## Testing

- Unit tests for the AI module (mocked Gemini responses → parsed entry fields) and
  month-bucketing logic (timezone and birthdate edge cases).
- Integration test for the record → upload → process → entry-ready flow with a mocked
  AI provider.
- Manual verification on a real phone browser (recording UX can't be meaningfully
  tested headless).

## Out of scope for v1

- Partner/family sharing, share-by-link
- Push notification reminders
- PDF export (v2)
- Native apps
- Multiple children per account
