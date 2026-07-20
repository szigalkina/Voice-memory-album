# STATE — Voice Baby Album

> Living handoff file. A fresh session (or a weaker model) must be able to
> continue from THIS FILE ALONE, without the original conversation. Update in
> place with dated sections; never delete prior content. Sibling docs:
> `docs/ROADMAP.md` (prescriptive how-to for future actions, ground rules),
> `PRODUCT.md` (who/why), `DESIGN.md` (visual system), README.md (public intro).

## 2026-07-20 — Full state dump

### What this is, where it runs

Voice-first baby journal, built 2026-07-19/20 from scratch. A parent taps one
button, talks in any language; Gemini transcribes and writes a quiet, tender
book page (title, message, quote, milestone flag, photo prompt); photos attach;
a swipeable "photo book" album grows from the first entry and exports as a
21×21 cm print-ready PDF. Aesthetic: "Atelier" — Artipoppe-inspired monochrome
luxury (bone/ink, Cormorant Garamond + Marck Script, micro-caps labels, no emoji).

- Production: **https://voice-baby-album.vercel.app** (Vercel project
  `voice-baby-album`, team `svetlana-zigalkina-de-boer-s-projects`, CLI logged
  in as `szigalkina`). DB: Neon (marketplace, `neon-beige-school`). Files:
  PRIVATE Vercel Blob store `vba-media` (two orphan stores exist:
  `voice-baby-album-files` public — still serves ONE legacy test entry — and
  `voice-baby-album-private`, unused; fold cleanup into ROADMAP ACTION 3).
- Code: **https://github.com/szigalkina/Voice-baby-album** (origin/main; plain
  `git push` works from the owner's Mac).
- Local dev: zero-config (PGlite in `.data/`, disk storage, mock AI, on-screen
  reset links). `.env.local` intentionally holds ONLY the Gemini key —
  `npx vercel env pull` would re-attach prod DB/Blob to local dev: dangerous,
  don't leave it that way (split-brain + real-data risk).
- Env (Production, all set): DATABASE_URL, BLOB_READ_WRITE_TOKEN, AUTH_SECRET,
  APP_URL, GEMINI_API_KEY, GEMINI_MODEL=gemini-flash-latest. NOT set:
  RESEND_API_KEY (password-reset + support emails silently no-op until added).

### Decisions and WHY (chronological, including reversals)

1. Mobile-first web app (PWA), not messenger bot / native — fastest, no store.
2. Living book album (not feed): one page per entry — owner simplified an
   earlier alternating-spread design ("one rule" is clearer; editing natural).
3. AI = Gemini Flash free tier, ONE call (audio→structured JSON). Owner's new
   API key can't use pinned `gemini-2.5-flash` ("not available to new users") →
   default is rolling alias `gemini-flash-latest`.
4. Auth: password accounts (scrypt, no deps). Magic links built first, then
   REPLACED at owner request. Partner invite codes built, then REMOVED at owner
   request (tables/guard membership logic kept, harmless).
5. Storage: private-by-default. Files served only via authenticated per-family
   gateways (/api/media for blob, /api/files for local disk — SAME access rules)
   with HTTP Range support (Safari refuses audio without 206s — real bug found
   in owner's phone test).
6. Sharing: view-only revocable links (owner picked from three options).
   `babies.share_token`; /shared/[token] public book; media honors ?share=.
7. iOS app: PLANNED (Capacitor, roadmap ACTION 5) then CANCELED by owner —
   "web browser on the phone is just fine". Do not resurrect unprompted.
8. Print: PDF export (full / pages-only / cover-only). NO print-service
   integration — deliberate. Albelli confirmed editor-only, no PDF intake;
   PDF-accepting printers: Blurb, PrestoPhoto, Mixam (their editors do covers).
9. Design: owner asked for Artipoppe-style "expensive exclusive" → Atelier
   system implemented everywhere (see DESIGN.md). Replaced the earlier warm
   playful apricot/emoji look ("fun" now whispers: breathing record button,
   hairline milestone bloom, haptic-adjacent restraint).
10. Date rule (owner): the date appears in ONE style at ONE position (absolute
    bottom-center) on every book/PDF page. Month caption top = chapter marker.
11. Multi-album accounts (owner request): /account page lists albums, switch via
    vba_album cookie; onboarding creates additional albums; editable cover
    title (tap to edit; empty = default "the first year of <name>").
12. Support: form on /account → Resend email to szigalkina@gmail.com when key
    set; 501→ mailto fallback meanwhile.

### Built and verified (everything below is deployed + tested against prod)

Recording (waveform, 5-min auto-stop) → AI entry pipeline (mock locally, real
in prod; failed entries keep audio + retry) → photos (gallery picker, ≤15MB,
jpeg/png/webp/gif; HEIC rejected with actionable message) → journal cards →
book album (swipe pages, edit sheet: title/message/photo add/remove) → share
links → PDF export (cover honors custom title) → account/albums/support →
password reset flow → rate limiting (login/signup/reset/support) → storage
cleanup on delete → AUTH_SECRET prod guard → focus-visible outlines.
Tests: 17 passing (`npm test`); layout engine + AI parsing + months + password.

### Pending / deferred (priority order)

1. RESEND_API_KEY — one free key activates reset + support emails.
2. Legacy cleanup: first test entry uses old public store; delete entry + both
   orphan blob stores together (ROADMAP ACTION 3 note).
3. Offline recording queue (note lost if upload fails on dead connection).
4. `recordedAt` not editable; photos-per-entry uncapped server-side (book shows
   4); album list order nondeterministic (add ORDER BY if noticed).
5. Multiple babies = multiple albums DONE, but no album delete/rename-name UI
   (only title), no member management UI.
6. Web push reminders (ROADMAP ACTION 6) — PWA-compatible, iOS 16.4+.

### Rules and constraints (cost time when violated)

- OWNER: full autonomy expected; simple/clear/fun-but-quiet UI; answers fast
  A/B/C questions; new global rule = THIS FILE's existence (update at ~95%
  context, at milestones; rule text in ~/.claude/CLAUDE.md).
- NEVER `npm run build` while `next dev` runs (shared `.next` breaks the server).
- Schema change = lib/schema.ts AND idempotent SQL in lib/db.ts DDL, both.
- Providers only inside lib/{ai,storage,db}.ts; app must run with zero env vars.
- PGlite quirks: needs `serverExternalPackages` in next.config.ts and the
  globalThis db singleton (split-brain otherwise); mkdir parent dirs first.
- Design: tokens/fonts in globals.css @theme only (legacy token names are
  ALIASES to Atelier values — don't "fix" them blindly); .label-caps is the one
  kicker system; no emoji, no exclamation marks anywhere incl. AI output.
- Media/date/book rules: see decisions 5 and 10; book layout engine is
  lib/book.ts (unit-tested — change tests with it).
- Verification bar: typecheck + tests + real browser (375px) before "done";
  curl against prod after deploy. Evidence before assertions.

### Accounts/testing notes

Prod test account: szigalkina+test@gmail.com / testpassword1 (baby "Mila",
owner's real account is separate). Local dev seeds: test@example.com /
newpassword99 (password was rotated during reset-flow test), babies Mila+Theo.
Owner's Gemini key is in Vercel env + chat history — offer rotation if she
ever wants it clean.

## 2026-07-20 (later) — Generic albums + Resend prep

- Albums generalized beyond "first year": onboarding = "a new album" (name +
  "when does it begin?"); headers/covers default to the album NAME (the
  "the first year of" eyebrow is gone — type it as a custom title if wanted);
  age label replaced by "month N" (album month); account cards say
  "began <month year>". AI prompt covers any moment, not only babies.
  DB unchanged: `babies.name` = album name, `babies.birthdate` = start date.
- Resend sender fixed: `RESEND_FROM` env (default `onboarding@resend.dev` —
  the old hardcoded voicebabyalbum.app sender would have been rejected; we
  don't own that domain). LIMITATION until a custom domain is verified in
  Resend: emails deliver ONLY to the Resend account owner's own address —
  fine for support (goes to owner) and her own password reset; a reset email
  to a partner's separate account will not deliver. Fix later = buy/verify a
  domain in Resend and set RESEND_FROM.

## 2026-07-20 (later still) — Renamed to "Voice Memory Album"

Brand renamed from Voice Baby Album across all app surfaces (UI, manifest, PDFs,
emails, privacy, README/PRODUCT/DESIGN, package.json). URLs deliberately KEPT:
voice-baby-album.vercel.app and github.com/szigalkina/Voice-baby-album still
work (renaming would break live share links, home-screen icons, and the git
remote). CLI aliases for voice-memory-album.vercel.app hit Vercel Deployment
Protection SSO (only the production domain is public) — alias removed. To add
the new-name URL properly: Vercel dashboard → voice-baby-album → Settings →
Domains → add `voice-memory-album.vercel.app` (project domains are public and
auto-update). Real long-term answer: a custom domain. Historical docs under
docs/superpowers keep the old name on purpose.

## 2026-07-20 (evening) — Full rename executed; one dashboard step remains

- GitHub repo RENAMED: github.com/szigalkina/Voice-memory-album (old URL
  auto-redirects; local remote updated by gh).
- Vercel project RENAMED to `voice-memory-album` (project ID unchanged, env/
  integrations intact). BUT the production domain is still
  voice-baby-album.vercel.app — vercel.app subdomains can't be added/edited via
  CLI ("not valid") and deployment aliases hit SSO protection. OWNER ACTION:
  dashboard → voice-memory-album project → Settings → Domains → edit/add
  `voice-memory-album.vercel.app`. AFTER that: set APP_URL env to the new URL,
  redeploy, verify old links (redirect or re-add old domain), update README Live
  URL. Until then APP_URL stays https://voice-baby-album.vercel.app (was briefly
  flipped and reverted — share/reset links must always match the serving domain).
- RESEND_API_KEY (sending-only key) set in production; live support-form email
  verified delivered to the owner. Sender = onboarding@resend.dev default;
  RESEND_FROM can switch to a verified domain later (key can't list domains, so
  unknown whether her Resend account has one — ask her).
