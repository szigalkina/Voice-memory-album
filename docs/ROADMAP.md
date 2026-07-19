# Voice Baby Album — Roadmap & Operating Manual

> **Audience:** any developer or AI agent picking up this project. Follow the steps
> LITERALLY and IN ORDER within each action. Do not improvise, do not refactor
> unrelated code, do not skip verification steps. When an action says "STOP", stop
> and ask the owner (Svetlana).

## Ground rules (read first, apply always)

1. Work on branch `main` or a feature branch merged back to `main`. Every commit
   message ends with the `Co-Authored-By` line used in `git log`.
2. **NEVER run `npm run build` while `npm run dev` is running.** They share `.next`
   and the dev server breaks. Kill dev first (`pkill -f "next dev"`), build, restart.
3. After ANY code change run: `npx tsc --noEmit && npm test`. Both must pass before
   commit. If a UI screen changed, also open it in a 375px-wide browser and look.
4. All AI calls go through `lib/ai.ts` only. All storage through `lib/storage.ts`
   only. All DB access through `getDb()` from `lib/db.ts` only. Never import
   providers (Gemini/Blob/Neon/PGlite) anywhere else.
5. The app must ALWAYS keep working with zero env vars (PGlite + disk + mock AI).
   Every new external service needs a local fallback behind an env-var check.
6. Schema changes: edit `lib/schema.ts` AND add matching idempotent SQL
   (`CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) to
   the `DDL` string in `lib/db.ts`. Both places, always.
7. UI rules: palette + fonts are defined in `app/globals.css` `@theme` (milk/ink/
   apricot/sage + Fraunces/Outfit/Caveat). Never introduce new colors or fonts.
   Book pages use the handwritten font (`font-hand`). Keep the one-rule book
   layout: one entry = one page.

## Current state (2026-07-19)

Done and verified: recording → AI entry pipeline (Gemini/mock), photo uploads,
password accounts (scrypt), partner invite codes → shared album, photo-book album
(one page per entry, handwritten style, swipe), per-page editing (title, message,
add/remove photos), journal list, PWA manifest. Tests: 17 passing. Not deployed.

---

## ACTION 1 — Deploy to production (blocked on owner login)

Prereq: owner has run `npx vercel login` in the project directory. If not: STOP.

1. `cd` to the project root. Run `npx vercel link --yes` (creates the project).
2. Run `npx vercel deploy` → preview URL. Open it; sign-up page must render.
3. Provision database: `npx vercel integration add neon` (accept defaults; if the
   CLI flow requires the dashboard, do it at vercel.com → Storage → Neon, then
   `npx vercel env pull .env.local` and confirm `DATABASE_URL` appears).
4. Provision blob store: vercel.com → Storage → Blob → Create. Confirm
   `BLOB_READ_WRITE_TOKEN` exists in project env vars.
5. Set remaining env vars (Production scope):
   - `AUTH_SECRET` = output of `openssl rand -hex 32`
   - `APP_URL` = the production URL (e.g. `https://voice-baby-album.vercel.app`)
   - `GEMINI_API_KEY` = owner creates at aistudio.google.com → API keys (free)
6. `npx vercel deploy --prod`.
7. Verify on the production URL, in order: create account → onboarding → record a
   note (real phone!) → entry appears with real AI title → add photo → album book
   shows the page → second account joins via invite code and sees the album.
8. If recording fails on iPhone Safari: check the served page is HTTPS and
   `audio/mp4` is picked (see `pickMime` in `components/Recorder.tsx`).

## ACTION 2 — Password reset by email

Files to create: `app/api/auth/reset-request/route.ts`,
`app/api/auth/reset/route.ts`, `app/reset/page.tsx`.

1. Add table to `lib/schema.ts` AND `lib/db.ts` DDL:
   `reset_tokens (token text primary key, user_id uuid not null references users(id), expires_at timestamp not null)`.
2. `reset-request` POST `{email}`: always respond `{ok:true}` (do not reveal
   whether the email exists). If the user exists: insert token
   (`crypto.randomBytes(32).toString("hex")`, 30 min expiry) and send email via
   Resend (`RESEND_API_KEY`, same fetch pattern that existed in git history —
   see commit `2341b38` for the exact Resend call). Without the env var, return
   `{ok:true, devLink}` exactly like the old magic-link route did.
3. `reset` POST `{token, password}`: validate token not expired, password ≥ 8
   chars, update `users.password_hash` using `hashPassword` from
   `lib/password.ts`, delete token, create session.
4. `app/reset/page.tsx`: form with new password field, reads `?token=` from URL.
   Add "Forgot password?" link on `app/signin/page.tsx` below the form.
5. Tests: reuse `lib/password.test.ts` style; test expired token → 400.

## ACTION 3 — Delete stored files when photos/entries are deleted

Currently deleting a photo/entry leaves the file in storage. Fix:

1. In `lib/storage.ts` add `deleteFile(url: string)`: if url starts with
   `/api/files/`, `fs.unlink` the mapped path under `.data/uploads` (ignore
   errors); else if `BLOB_READ_WRITE_TOKEN` set, `const { del } = await import("@vercel/blob"); await del(url)`.
2. Call it: in `app/api/entries/[id]/photos/[photoId]/route.ts` after DB delete
   (pass `deleted[0].blobUrl`); in `app/api/entries/[id]/route.ts` DELETE — first
   select the entry's photos and audioUrl, delete DB row, then delete each file.
3. Test manually: add + remove a photo locally, confirm the file disappears from
   `.data/uploads/photos/`.

## ACTION 4 — Print-ready PDF export ("Export for print")

Goal: a downloadable PDF of the album at 21×21 cm, 300 DPI, 3 mm bleed — the user
uploads it to Albelli/any print service themselves. No print API integration.

1. `npm install @react-pdf/renderer` (server-side render works on Vercel functions).
2. Create `lib/pdf.tsx`: a React-PDF document that maps `buildBookPages(...)`
   output to fixed pages: page size `[612, 612]`pt equivalent for 21.6×21.6 cm
   incl. bleed (21 cm + 3 mm bleed each side; 1 cm = 28.3465 pt → use 612.3 pt).
   Reuse the exact layout rules from `components/BookPage.tsx`: photo-less page =
   centered text + date; otherwise title/message top, photo grid (1 large / 2x2
   squares), date bottom. Register the Caveat font via `Font.register` (download
   TTF once into `public/fonts/Caveat.ttf` from Google Fonts).
3. Create `app/api/export/route.ts` GET: `requireBaby()`, fetch album entries
   (ready + inAlbum, ascending), render with `renderToBuffer`, respond with
   `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="<baby>-album.pdf"`.
   For photos: load bytes server-side (same dual disk/URL loader as
   `app/api/entries/[id]/retry/route.ts` → `loadAudio`, generalize it).
4. Add an "⬇ Export for print" button in the Album header (book view only).
5. Verify: export locally with demo data, open PDF, check page size and fonts.

## ACTION 5 — Ship to the App Store (and optionally Google Play)

Owner decision 2026-07-19: YES to app stores. Apple Developer membership already
active. Xcode 26.6 installed on the build Mac. Strategy: Capacitor shell over the
production site (no rewrite). Do the phases IN ORDER.

### Phase 5.0 — Prerequisites (blocking)
1. ACTION 1 fully done: production URL live with database + HTTPS, full flow
   verified on a real phone in the browser. The app shell loads this URL — a
   broken site means a broken app.
2. Create `app/privacy/page.tsx`: a plain-language privacy policy page (what is
   stored: email, password hash, voice recordings, transcripts, photos; where:
   Vercel/Neon servers; AI processing via Google Gemini; no ads, no data sale;
   contact email; deletion: delete entries in-app or email the owner). App Store
   review REQUIRES a public privacy policy URL.

### Phase 5.1 — Capacitor shell (once)
1. `npm install @capacitor/core @capacitor/cli @capacitor/ios`
2. `npx cap init "Voice Baby Album" com.voicebabyalbum.app --web-dir public`
   (web-dir is a formality — we load the remote URL).
3. Edit `capacitor.config.ts`: add
   `server: { url: "https://<PROD-URL>", cleartext: false }`.
4. `npx cap add ios`
5. Permissions — in `ios/App/App/Info.plist` add:
   - `NSMicrophoneUsageDescription` = "Voice Baby Album records your voice notes
     about your baby."
   - `NSCameraUsageDescription` = "Take photos of the moment to add to a memory."
   - `NSPhotoLibraryUsageDescription` = "Choose photos to add to your baby's album."
6. Icons/splash: `npm install -D @capacitor/assets`, put `public/icon-512.png` at
   `assets/icon.png` (1024px version: upscale the SVG with qlmanage at -s 1024),
   milk `#faf6f0` splash background, run `npx capacitor-assets generate --ios`.
7. `npx cap open ios` → in Xcode: set Team (owner's Apple Developer team),
   bundle id `com.voicebabyalbum.app`, run on Simulator → sign in, record
   (simulator mic works), verify journal + album render.
8. Run on the owner's real iPhone via cable once — verify mic + photo picker.

### Phase 5.2 — Review-risk hardening (do BEFORE submitting)
Apple guideline 4.2 rejects bare website wrappers. Make the shell feel native:
1. `npm install @capacitor/haptics @capacitor/status-bar @capacitor/splash-screen`
2. In the web app, detect Capacitor (`window.Capacitor?.isNativePlatform()`):
   trigger a light haptic on record start/stop and on milestone celebration.
3. Status bar: match milk background (StatusBar.setBackgroundColor / style).
4. Native push notifications (replaces ACTION 6's web-push on iOS):
   `@capacitor/push-notifications`, register token, store in the
   `push_subscriptions` table with a `platform` column, send via APNs from the
   cron route (use `node-apn` or a service; simplest: keep web-push for browsers
   AND APNs for the app). This is the single strongest 4.2 mitigation.
5. In App Store Connect "App Review Information" notes, describe the native
   features (mic recording, push, haptics) and provide a demo account:
   create `demo@voicebabyalbum.app` with password, pre-filled with 3 demo
   entries + photos (use the seed flow from the dev scripts).

### Phase 5.3 — TestFlight (both parents, this week)
1. Xcode → Product → Archive → Distribute → App Store Connect → Upload.
2. appstoreconnect.apple.com → create the app record (name "Voice Baby Album",
   primary language, bundle id, SKU `vba-001`).
3. TestFlight tab → add both parents as internal testers → they install via the
   TestFlight app. NOTE: builds expire after 90 days — the public release
   (Phase 5.4) is the durable path, TestFlight is not a substitute.

### Phase 5.4 — App Store release
1. Screenshots: 6.9" (1320×2868) and 6.5" (1284×2778) — take from Simulator
   (record screen: signin, journal with entries, book page with photos, edit
   sheet). 4–6 screenshots.
2. Listing copy: subtitle "Your baby's year, in your voice"; description from
   README's first paragraph; keywords: baby journal, baby book, voice diary,
   milestones, memory book, first year.
3. App Privacy questionnaire (answer honestly): collects Contact Info (email),
   User Content (photos, audio, other user content), linked to identity, not
   used for tracking. Age rating: 4+.
4. Privacy policy URL: `https://<PROD-URL>/privacy` (from Phase 5.0).
5. Submit for review. If rejected under 4.2: reply pointing at push
   notifications, mic integration, haptics; if still rejected, the fallback is
   bundling the UI as static assets in the app (bigger job: split the frontend
   to talk to the API cross-origin — only do this if actually rejected twice).

### Phase 5.5 — Google Play (optional, $25 one-time)
The $25 is Google's ONE-TIME lifetime registration fee for a Google Play
developer account (play.google.com/console) — it exists purely to publish
Android apps. Skip it entirely if both parents use iPhones; buy it only when an
Android user needs the app. Then: `npm install @capacitor/android`,
`npx cap add android`, same permissions in `AndroidManifest.xml` (RECORD_AUDIO,
CAMERA, READ_MEDIA_IMAGES), `npx capacitor-assets generate --android`, build a
signed AAB in Android Studio, upload to Play Console, fill the Data Safety form
(mirror the Apple answers). NOTE: new personal Play accounts require a 12-person
/ 14-day closed test before production release — factor in that delay.

## ACTION 6 — Gentle reminders (Web Push)

1. `npm install web-push`. Generate VAPID keys once
   (`npx web-push generate-vapid-keys`) → env vars `VAPID_PUBLIC_KEY`,
   `VAPID_PRIVATE_KEY` (+ expose public one to the client).
2. Add `push_subscriptions (user_id uuid, subscription jsonb)` table (schema +
   DDL, rule 6).
3. Add a minimal service worker `public/sw.js` with a `push` event listener
   showing the notification; register it in `app/layout.tsx` client-side.
4. Settings UI: a bell toggle in the journal header → `Notification.requestPermission()`
   → `registration.pushManager.subscribe` → POST subscription to a new
   `app/api/push/subscribe/route.ts`.
5. Sending: Vercel Cron (`vercel.json` → `{"crons":[{"path":"/api/push/nudge","schedule":"0 18 * * *"}]}`)
   → route picks users with no entry in 3+ days → web-push a warm nudge
   ("What did ⟨name⟩ do today? 🎙"). Cap: max 1 nudge per 3 days per user.

## ACTION 7 — Quality/security hardening (do opportunistically)

- Rate-limit `POST /api/auth/login` and `signup`: simplest is an in-memory map
  keyed by IP allowing 10 attempts/10 min (module-level, resets on deploy — fine),
  return 429 beyond it.
- `PATCH /api/entries/[id]`: also accept `recordedAt` (ISO date) so users can
  correct a memory's date; validate with `!isNaN(Date.parse(v))`.
- Photos per entry: server currently accepts unlimited; reject uploads when the
  entry already has 8 photos (book shows 4; journal shows all).
- Add `Suspense`-based loading states if any page starts feeling slow.

## Costs summary (for the owner)

| Item | Cost |
|---|---|
| Vercel Hobby (site + functions + cron) | $0 (fine for a family app) |
| Neon Postgres free tier | $0 (0.5 GB — thousands of entries) |
| Vercel Blob (audio + photos) | ~$0.02/GB-month stored; a full first year (≈500 photos ≈ 2 GB + audio ≈ 0.5 GB) ≈ **pennies/month** |
| Gemini Flash free tier | $0 (1,500 requests/day ≫ needed) |
| Resend free tier | $0 (3,000 emails/month) |
| Apple App Store | already covered by owner's membership |
| Google Play (only if Android needed, Phase 5.5) | $25 once, lifetime |

So: web app ≈ **$0/month** at family scale. App stores are the only real cost.

## DONE 2026-07-19 (post-launch): Private media storage

Photos and audio now live in a PRIVATE Vercel Blob store (`vba-media`). The DB
stores app-internal `/api/media/<encoded-blob-url>` URLs; `app/api/media/[blob]/route.ts`
authenticates the session, verifies the file belongs to the user's baby, and
streams it. `lib/storage.ts#readStoredFile` reads all three historical URL shapes
(private blob, local disk, legacy public blob). The old public store
`voice-baby-album-files` and orphan `voice-baby-album-private` store still exist:
the public one serves one legacy test entry — fold their cleanup into ACTION 3.
`.env.local` is intentionally trimmed to Gemini-only so local dev stays isolated
(PGlite + disk); `npx vercel env pull .env.local` re-attaches prod services.

## DONE 2026-07-19 (evening): Atelier redesign + PDF export shipped

- Full monochrome luxury restyle per DESIGN.md ("Atelier"): bone/ink OKLCH tokens
  (legacy token names aliased in globals.css), Cormorant Garamond + Marck Script
  (both Cyrillic), micro-caps label system (.label-caps), waveform brand mark
  (components/WaveMark.tsx), no emoji anywhere, AI prompt enforces quiet voice.
- ACTION 4 (PDF export) is DONE: lib/pdf.tsx + app/api/export (21x21cm square,
  cover + one page per entry, wrap={false}, fonts in public/fonts). Delivery is
  direct download from the album ("export as pdf" button). Email/WeTransfer
  delivery intentionally NOT built: WeTransfer has no usable public API and email
  attachments cap ~40MB; revisit only if downloads prove unwieldy.
- Sharing options proposed to owner (view-only album link vs co-editor invites vs
  plain app link); awaiting decision. Invite-code system was removed earlier the
  same day; view-only share link is the leading candidate (ACTION for later:
  share_tokens table + /shared/[token] read-only book page, revocable).
