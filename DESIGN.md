# DESIGN.md — Voice Baby Album

## Status
Current implementation = "warm playful" system (milk/apricot/sage, Fraunces/Outfit/
Caveat, emoji, rounded-3xl). Target system below = **"Atelier" (Artipoppe-inspired
quiet luxury)**, approved direction pending owner sign-off. All values here are the
target; `app/globals.css` @theme is the single source of truth once migrated.

## Color (OKLCH; restrained — interface is monochrome, content carries color)
- `--color-bone`: oklch(0.955 0.006 84)  — body background (gallery light)
- `--color-paper`: oklch(0.975 0.004 84) — book pages, sheets
- `--color-ink`: oklch(0.20 0.01 60)     — text, buttons, rules (near-black warm)
- `--color-ink-soft`: oklch(0.45 0.012 60) — secondary text (≥4.5:1 on bone)
- `--color-ink-faint`: oklch(0.20 0.01 60 / 12%) — hairline borders
- No accent color. States: error = oklch(0.42 0.10 30) (dried-blood umber), used
  only for destructive/error text. Success/info communicated in ink.

## Typography (3 families, hard cap)
- Display serif: **Cormorant Garamond** (latin + cyrillic), weights 300/400 +
  italics. Baby name, page titles, headings. Large sizes only (≥20px).
- UI sans: **Outfit** (kept), 300–500. Body, forms, buttons.
- Script (book quotes only): **Marck Script** (cyrillic-capable fine pen script),
  replaces Caveat. Used solely for the parent-quote line on book pages.
- Label system: 10–11px Outfit 500, uppercase, letter-spacing 0.18em, ink-soft.
  This is the ONE deliberate kicker system (Artipoppe-style micro-caps), used for:
  month markers, dates, nav labels, "milestone". Never above ordinary headings.
- Scale: 11 / 14 / 15 (body) / 20 / 28 / 40 (name display). Ratio ~1.3.

## Shape & surfaces
- Corners: 2px (inputs, buttons), 4px (photos, sheets). No pills except the two
  circular record buttons.
- Borders: 1px ink-faint hairlines. No drop shadows anywhere except the book page
  (single soft paper shadow) and the record button (pressed depth).
- The brand mark: a 9-bar engraved waveform hairline (thin ink lines) used as the
  section divider and empty-state ornament. No other decorative element.

## Components
- Record button: 88px ink circle, thin bone ring inset; recording = slow 2.4s
  breathing ring + live hairline waveform; uploading = thin arc spinner.
- Buttons: primary = ink rectangle, bone text, tracked caps 12px; secondary =
  underlined ink text link. No colored buttons.
- Milestone: micro-caps "MILESTONE" between two 24px hairlines. Celebration =
  1.8s single slow fade/expand of the hairlines (no particles, no emoji).
- Photos: always matted (paper padding + hairline), sharp 2px corners.
- Nav: hairline-top bar, two micro-caps labels (JOURNAL / ALBUM), active = ink,
  inactive = ink-soft. No icons, no pill.
- Forms: bone field, hairline border, 2px corners; focus = ink border (no ring
  glow). Placeholder ink-soft.

## Motion
- 180–240ms, ease-out-quart, opacity/transform only. Book page turn: 300ms fade
  + 8px slide. Record breathing: 2.4s ease-in-out loop.
- `prefers-reduced-motion`: all loops static, transitions become crossfades.

## Copy voice
Lowercase, sparse, tender. No exclamation marks, no emoji anywhere (UI or AI
output — the AI prompt enforces this). Dates as micro-caps ("19 JULY 2026").
