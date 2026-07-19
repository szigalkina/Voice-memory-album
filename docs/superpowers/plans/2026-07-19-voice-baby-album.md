# Voice Baby Album Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Voice Baby Album v1 per the approved spec — a mobile-first PWA where a parent records voice notes, AI turns them into titled/summarized entries with milestone detection and photo prompts, and a living album timeline grows from the first entry.

**Architecture:** Single Next.js (App Router, TypeScript) app. Every external dependency is wrapped in a swappable module with a zero-credential dev fallback: Postgres via Drizzle (PGlite embedded locally / Neon in prod via `DATABASE_URL`), file storage (local disk / Vercel Blob via `BLOB_READ_WRITE_TOKEN`), AI (deterministic mock / Gemini Flash via `GEMINI_API_KEY`), magic-link email (link shown on screen in dev / Resend via `RESEND_API_KEY`). AI processing happens synchronously inside the entry-creation request (Gemini Flash returns in seconds; the client shows a "thinking" state meanwhile).

**Tech Stack:** Next.js 16 App Router, Tailwind CSS v4, Drizzle ORM, `@electric-sql/pglite`, `@neondatabase/serverless`, `@vercel/blob`, `jose` (session JWT), Vitest, browser MediaRecorder API, Gemini Flash via REST (`generateContent` with inline base64 audio + JSON response schema).

**Design direction (applies to all UI tasks):** warm keepsake aesthetic, mobile-first. Palette: milk `#FAF6F0` background, deep plum ink `#3D2C3C`, apricot accent `#F49E6D`, dusty sage `#9BB49A`. Fonts: Fraunces (display), Outfit (body) via `next/font/google`. Big touch targets, generous rounding (`rounded-3xl`), soft shadows, one hero record button. No purple gradients, no Inter.

---

### Task 1: Scaffold the app

**Files:**
- Create: entire Next.js skeleton at repo root (via create-next-app in a temp dir, moved in — repo root is non-empty)
- Modify: `package.json` (test scripts), `.gitignore` (`.data/`)

- [ ] **Step 1: Scaffold in temp dir and move into repo root**

```bash
cd "/Users/svetlanazigalkinadeboer/Mom journal app"
npx create-next-app@latest /tmp/vba-scaffold --ts --tailwind --app --no-src-dir --import-alias "@/*" --eslint --no-turbopack --yes
rsync -a /tmp/vba-scaffold/ ./ --exclude node_modules --exclude .git
npm install
```

- [ ] **Step 2: Install runtime + dev deps**

```bash
npm install drizzle-orm @electric-sql/pglite @neondatabase/serverless @vercel/blob jose
npm install -D vitest
```

- [ ] **Step 3: Add test script and ignore local data dir**

In `package.json` scripts add: `"test": "vitest run"`.
Append to `.gitignore`:

```
.data/
```

- [ ] **Step 4: Verify dev server boots**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js app"
```

---

### Task 2: Database layer (schema + client with PGlite/Neon switch)

**Files:**
- Create: `lib/schema.ts`, `lib/db.ts`

- [ ] **Step 1: Write the Drizzle schema**

`lib/schema.ts`:

```ts
import { pgTable, text, timestamp, boolean, uuid, date } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const loginTokens = pgTable("login_tokens", {
  token: text("token").primaryKey(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const babies = pgTable("babies", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  birthdate: date("birthdate").notNull(),
});

export const entries = pgTable("entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  babyId: uuid("baby_id").notNull().references(() => babies.id),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
  audioUrl: text("audio_url").notNull(),
  transcript: text("transcript"),
  title: text("title"),
  summary: text("summary"),
  quote: text("quote"),
  isMilestone: boolean("is_milestone").notNull().default(false),
  milestoneType: text("milestone_type"),
  photoPrompt: text("photo_prompt"),
  inAlbum: boolean("in_album").notNull().default(false),
  status: text("status").notNull().default("processing"), // processing | ready | failed
});

export const photos = pgTable("photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  entryId: uuid("entry_id").notNull().references(() => entries.id, { onDelete: "cascade" }),
  blobUrl: text("blob_url").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

- [ ] **Step 2: Write the db client with bootstrap DDL**

`lib/db.ts` — one `getDb()` that picks Neon when `DATABASE_URL` is set, else embedded PGlite persisted to `.data/pglite`; runs idempotent DDL on first connect:

```ts
import * as schema from "./schema";
import { sql } from "drizzle-orm";

const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS login_tokens (
  token text PRIMARY KEY,
  email text NOT NULL,
  expires_at timestamp NOT NULL
);
CREATE TABLE IF NOT EXISTS babies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  birthdate date NOT NULL
);
CREATE TABLE IF NOT EXISTS entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id uuid NOT NULL REFERENCES babies(id),
  recorded_at timestamp NOT NULL DEFAULT now(),
  audio_url text NOT NULL,
  transcript text,
  title text,
  summary text,
  quote text,
  is_milestone boolean NOT NULL DEFAULT false,
  milestone_type text,
  photo_prompt text,
  in_album boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'processing'
);
CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  blob_url text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dbPromise: Promise<any> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      if (process.env.DATABASE_URL) {
        const { drizzle } = await import("drizzle-orm/neon-http");
        const db = drizzle(process.env.DATABASE_URL, { schema });
        await db.execute(sql.raw(DDL));
        return db;
      }
      const { PGlite } = await import("@electric-sql/pglite");
      const { drizzle } = await import("drizzle-orm/pglite");
      const client = new PGlite(".data/pglite");
      const db = drizzle(client, { schema });
      await db.execute(sql.raw(DDL));
      return db;
    })();
  }
  return dbPromise;
}
```

Note: Neon's HTTP driver runs one statement per request — if `db.execute(sql.raw(DDL))` fails on multi-statement input, split `DDL` on `;` and execute sequentially. Handle this inside `getDb` (loop over `DDL.split(";")`, skip blanks) so both drivers take the same path.

- [ ] **Step 3: Smoke-test the db boots**

Run: `npx tsx -e "import('./lib/db').then(async m => { const db = await m.getDb(); console.log('db ok'); })"` (install `tsx` as a dev dep if missing).
Expected: prints `db ok`, `.data/pglite` directory created.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: database schema and client with PGlite/Neon switch"
```

---

### Task 3: Month bucketing (TDD)

**Files:**
- Create: `lib/months.ts`, `lib/months.test.ts`

- [ ] **Step 1: Write the failing tests**

`lib/months.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { monthNumber, monthLabel } from "./months";

describe("monthNumber", () => {
  it("is 1 during the first month of life", () => {
    expect(monthNumber("2026-01-15", new Date("2026-01-15T10:00:00Z"))).toBe(1);
    expect(monthNumber("2026-01-15", new Date("2026-02-14T10:00:00Z"))).toBe(1);
  });
  it("rolls to 2 on the monthly anniversary", () => {
    expect(monthNumber("2026-01-15", new Date("2026-02-15T10:00:00Z"))).toBe(2);
  });
  it("handles birthdays late in the month (Jan 31 -> Feb)", () => {
    // Feb has no 31st; Feb 28 is still month 1, Mar 1 is month 2
    expect(monthNumber("2026-01-31", new Date("2026-02-28T10:00:00Z"))).toBe(1);
    expect(monthNumber("2026-01-31", new Date("2026-03-01T10:00:00Z"))).toBe(2);
  });
  it("clamps to 1 for entries dated before birth", () => {
    expect(monthNumber("2026-01-15", new Date("2026-01-01T10:00:00Z"))).toBe(1);
  });
});

describe("monthLabel", () => {
  it("formats as 'Month N — MonthName'", () => {
    expect(monthLabel("2026-01-15", 1)).toBe("Month 1 — January");
    expect(monthLabel("2026-01-15", 3)).toBe("Month 3 — March");
    expect(monthLabel("2026-11-15", 3)).toBe("Month 3 — January");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/months.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`lib/months.ts`:

```ts
// Month N of life: month 1 spans birthdate .. day-before first monthly anniversary.
// All math in UTC on calendar dates to avoid timezone drift.
export function monthNumber(birthdate: string, recordedAt: Date): number {
  const [by, bm, bd] = birthdate.split("-").map(Number);
  const ry = recordedAt.getUTCFullYear();
  const rm = recordedAt.getUTCMonth() + 1;
  const rd = recordedAt.getUTCDate();
  let months = (ry - by) * 12 + (rm - bm);
  if (rd < bd) months -= 1;
  return Math.max(1, months + 1);
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export function monthLabel(birthdate: string, monthNum: number): string {
  const [, bm] = birthdate.split("-").map(Number);
  const calendarMonth = (bm - 1 + (monthNum - 1)) % 12;
  return `Month ${monthNum} — ${MONTH_NAMES[calendarMonth]}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/months.test.ts`
Expected: PASS (5 tests). Note the Jan-31 case: `2026-02-28` gives `months = 1`, `rd(28) < bd(31)` → `months = 0` → month 1. `2026-03-01` gives `months = 2`, `rd(1) < bd(31)` → month 2. Correct per test.

- [ ] **Step 5: Commit**

```bash
git add lib/months.ts lib/months.test.ts && git commit -m "feat: month-of-life bucketing"
```

---

### Task 4: Auth (session JWT + magic-link routes + sign-in UI)

**Files:**
- Create: `lib/auth.ts`, `app/api/auth/request/route.ts`, `app/api/auth/verify/route.ts`, `app/api/auth/signout/route.ts`, `app/signin/page.tsx`

- [ ] **Step 1: Session helpers**

`lib/auth.ts`:

```ts
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-secret-not-for-production"
);
const COOKIE = "vba_session";

export async function createSession(userId: string) {
  const jwt = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("90d")
    .sign(SECRET);
  (await cookies()).set(COOKIE, jwt, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90, path: "/",
  });
}

export async function getUserId(): Promise<string | null> {
  const jwt = (await cookies()).get(COOKIE)?.value;
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, SECRET);
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}
```

- [ ] **Step 2: Magic-link request route**

`app/api/auth/request/route.ts` — creates a 15-minute token; sends via Resend when `RESEND_API_KEY` is set, otherwise returns the link in the response (dev mode):

```ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { loginTokens } from "@/lib/schema";

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  const token = crypto.randomBytes(32).toString("hex");
  const db = await getDb();
  await db.insert(loginTokens).values({
    token, email: email.toLowerCase(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });
  const base = process.env.APP_URL ?? new URL(req.url).origin;
  const link = `${base}/api/auth/verify?token=${token}`;

  if (process.env.RESEND_API_KEY) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Voice Baby Album <login@voicebabyalbum.app>",
        to: email, subject: "Your sign-in link",
        html: `<p>Tap to sign in to Voice Baby Album:</p><p><a href="${link}">Sign in</a></p><p>This link expires in 15 minutes.</p>`,
      }),
    });
    return NextResponse.json({ sent: true });
  }
  return NextResponse.json({ sent: true, devLink: link });
}
```

- [ ] **Step 3: Verify route**

`app/api/auth/verify/route.ts` — consumes token, upserts user, sets session, redirects to `/`:

```ts
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { loginTokens, users } from "@/lib/schema";
import { createSession } from "@/lib/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/signin?error=missing", url));
  const db = await getDb();
  const [row] = await db.select().from(loginTokens).where(eq(loginTokens.token, token));
  if (!row || row.expiresAt < new Date()) {
    return NextResponse.redirect(new URL("/signin?error=expired", url));
  }
  await db.delete(loginTokens).where(eq(loginTokens.token, token));
  let [user] = await db.select().from(users).where(eq(users.email, row.email));
  if (!user) {
    [user] = await db.insert(users).values({ email: row.email }).returning();
  }
  await createSession(user.id);
  return NextResponse.redirect(new URL("/", url));
}
```

- [ ] **Step 4: Sign-out route**

`app/api/auth/signout/route.ts`:

```ts
import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export async function POST(req: Request) {
  await clearSession();
  return NextResponse.redirect(new URL("/signin", req.url));
}
```

- [ ] **Step 5: Sign-in page**

`app/signin/page.tsx` — client component: email field, "Send me a sign-in link" button, success state ("Check your email 💌"); when the response contains `devLink`, render it as a tappable link labeled "Dev mode: tap to sign in". Shows friendly error for `?error=expired` ("That link expired — send a fresh one"). Styled per design direction.

- [ ] **Step 6: Verify flow manually**

Run: `npm run dev`, open `/signin`, submit an email.
Expected: dev link appears; tapping it redirects to `/` with `vba_session` cookie set.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: magic-link auth with dev-mode on-screen link"
```

---

### Task 5: File storage module + local file serving

**Files:**
- Create: `lib/storage.ts`, `app/api/files/[...path]/route.ts`

- [ ] **Step 1: Storage module**

`lib/storage.ts` — Vercel Blob when token present, else disk under `.data/uploads`:

```ts
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export async function saveFile(
  folder: "audio" | "photos",
  ext: string,
  data: Buffer,
  contentType: string
): Promise<string> {
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`${folder}/${name}`, data, {
      access: "public", contentType,
    });
    return blob.url;
  }
  const dir = path.join(process.cwd(), ".data", "uploads", folder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), data);
  return `/api/files/${folder}/${name}`;
}
```

- [ ] **Step 2: Local file-serving route**

`app/api/files/[...path]/route.ts`:

```ts
import { promises as fs } from "fs";
import path from "path";

const TYPES: Record<string, string> = {
  webm: "audio/webm", mp4: "audio/mp4", m4a: "audio/mp4",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const parts = (await params).path;
  const base = path.join(process.cwd(), ".data", "uploads");
  const filePath = path.resolve(base, ...parts);
  if (!filePath.startsWith(base + path.sep)) return new Response("Not found", { status: 404 });
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).slice(1);
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: storage module with disk fallback and Vercel Blob"
```

---

### Task 6: AI module (TDD on parsing; Gemini + mock)

**Files:**
- Create: `lib/ai.ts`, `lib/ai.test.ts`

- [ ] **Step 1: Write failing tests for the response parser**

`lib/ai.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseAnalysis, mockAnalysis } from "./ai";

const good = {
  transcript: "Сегодня она первый раз засмеялась!",
  title: "Первый смех",
  summary: "Малышка сегодня первый раз громко засмеялась, глядя на собаку.",
  quote: "первый раз засмеялась",
  is_milestone: true,
  milestone_type: "first_laugh",
  photo_prompt: "Есть фото этого счастливого момента?",
};

describe("parseAnalysis", () => {
  it("accepts a complete valid object", () => {
    expect(parseAnalysis(good)).toEqual(good);
  });
  it("coerces missing optional fields to null and booleans to false", () => {
    const r = parseAnalysis({ transcript: "hi", title: "Hi", summary: "s" });
    expect(r.quote).toBeNull();
    expect(r.is_milestone).toBe(false);
    expect(r.milestone_type).toBeNull();
    expect(r.photo_prompt).toBeNull();
  });
  it("throws on missing required fields", () => {
    expect(() => parseAnalysis({ title: "no transcript" })).toThrow();
    expect(() => parseAnalysis(null)).toThrow();
    expect(() => parseAnalysis("string")).toThrow();
  });
});

describe("mockAnalysis", () => {
  it("returns a valid analysis (round-trips through parseAnalysis)", () => {
    expect(() => parseAnalysis(mockAnalysis())).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/ai.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the AI module**

`lib/ai.ts`:

```ts
export interface EntryAnalysis {
  transcript: string;
  title: string;
  summary: string;
  quote: string | null;
  is_milestone: boolean;
  milestone_type: string | null;
  photo_prompt: string | null;
}

export function parseAnalysis(raw: unknown): EntryAnalysis {
  if (typeof raw !== "object" || raw === null) throw new Error("AI response is not an object");
  const o = raw as Record<string, unknown>;
  for (const k of ["transcript", "title", "summary"]) {
    if (typeof o[k] !== "string" || !o[k]) throw new Error(`AI response missing ${k}`);
  }
  const str = (k: string) => (typeof o[k] === "string" && o[k] ? (o[k] as string) : null);
  return {
    transcript: o.transcript as string,
    title: o.title as string,
    summary: o.summary as string,
    quote: str("quote"),
    is_milestone: o.is_milestone === true,
    milestone_type: str("milestone_type"),
    photo_prompt: str("photo_prompt"),
  };
}

export function mockAnalysis(): EntryAnalysis {
  return {
    transcript: "(dev mode) Today she laughed out loud for the very first time when the dog sneezed.",
    title: "First big laugh",
    summary: "She laughed out loud for the very first time today — set off by the dog sneezing.",
    quote: "laughed out loud for the very first time",
    is_milestone: true,
    milestone_type: "first_laugh",
    photo_prompt: "Did you catch that giggle on camera? Add a photo of this moment!",
  };
}

const PROMPT = `You are the gentle assistant inside a baby-journal app. A parent recorded a voice note about their baby. Listen to the audio and respond ONLY with JSON matching the schema. Rules:
- Write title, summary, quote and photo_prompt in the SAME LANGUAGE the parent spoke.
- transcript: faithful transcription of the audio.
- title: short warm title (max 6 words).
- summary: 1-2 sentences, warm but not saccharine, third person about the baby.
- quote: the most touching short phrase verbatim from the parent's words, or null.
- is_milestone: true only for genuine firsts/developmental milestones (first laugh, first steps, first word, first tooth...).
- milestone_type: short snake_case tag when is_milestone is true, else null.
- photo_prompt: one friendly sentence inviting the parent to add a photo of this specific moment.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    transcript: { type: "STRING" },
    title: { type: "STRING" },
    summary: { type: "STRING" },
    quote: { type: "STRING", nullable: true },
    is_milestone: { type: "BOOLEAN" },
    milestone_type: { type: "STRING", nullable: true },
    photo_prompt: { type: "STRING", nullable: true },
  },
  required: ["transcript", "title", "summary", "is_milestone"],
};

export async function analyzeVoiceNote(audio: Buffer, mimeType: string): Promise<EntryAnalysis> {
  if (!process.env.GEMINI_API_KEY) {
    await new Promise((r) => setTimeout(r, 800)); // simulate latency in dev
    return mockAnalysis();
  }
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType, data: audio.toString("base64") } },
            { text: PROMPT },
          ],
        }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const body = await res.json();
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");
  return parseAnalysis(JSON.parse(text));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/ai.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ai.ts lib/ai.test.ts && git commit -m "feat: AI module - Gemini Flash with dev mock and validated parsing"
```

---

### Task 7: Baby onboarding API + entries/photos API routes

**Files:**
- Create: `lib/guard.ts`, `app/api/baby/route.ts`, `app/api/entries/route.ts`, `app/api/entries/[id]/route.ts`, `app/api/entries/[id]/retry/route.ts`, `app/api/entries/[id]/photos/route.ts`

- [ ] **Step 1: Request guard helper**

`lib/guard.ts` — resolves the signed-in user and their baby in one call:

```ts
import { eq } from "drizzle-orm";
import { getUserId } from "./auth";
import { getDb } from "./db";
import { babies } from "./schema";

export async function requireUser() {
  const userId = await getUserId();
  if (!userId) throw new Response("Unauthorized", { status: 401 });
  return userId;
}

export async function requireBaby() {
  const userId = await requireUser();
  const db = await getDb();
  const [baby] = await db.select().from(babies).where(eq(babies.userId, userId));
  if (!baby) throw new Response("No baby profile", { status: 404 });
  return { userId, baby, db };
}
```

Route handlers wrap bodies in `try/catch` and `return e instanceof Response ? e : ...500`.

- [ ] **Step 2: Baby route**

`app/api/baby/route.ts`:
- `GET`: returns the user's baby or `{ baby: null }` (used by client to route to onboarding).
- `POST`: `{ name, birthdate }` → validates non-empty name + `YYYY-MM-DD` date, inserts (reject if one already exists), returns baby.

```ts
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { babies } from "@/lib/schema";
import { requireUser } from "@/lib/guard";

export async function GET() {
  try {
    const userId = await requireUser();
    const db = await getDb();
    const [baby] = await db.select().from(babies).where(eq(babies.userId, userId));
    return NextResponse.json({ baby: baby ?? null });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireUser();
    const { name, birthdate } = await req.json();
    if (!name?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(birthdate ?? "")) {
      return NextResponse.json({ error: "Name and birthdate (YYYY-MM-DD) required" }, { status: 400 });
    }
    const db = await getDb();
    const existing = await db.select().from(babies).where(eq(babies.userId, userId));
    if (existing.length) return NextResponse.json({ error: "Baby already exists" }, { status: 409 });
    const [baby] = await db.insert(babies).values({ userId, name: name.trim(), birthdate }).returning();
    return NextResponse.json({ baby });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Entries collection route**

`app/api/entries/route.ts`:
- `POST` (multipart: `audio` file): save audio via `saveFile`, insert entry `status=processing`, then synchronously run `analyzeVoiceNote`; on success update entry (`status=ready`, fields, `inAlbum = is_milestone`), on failure update `status=failed`. Return the final entry either way (a recording is never lost).
- `GET`: all entries for the baby, newest first, each with its photos array.

```ts
import { NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { entries, photos } from "@/lib/schema";
import { requireBaby } from "@/lib/guard";
import { saveFile } from "@/lib/storage";
import { analyzeVoiceNote } from "@/lib/ai";

export async function POST(req: Request) {
  try {
    const { baby, db } = await requireBaby();
    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json({ error: "Audio recording required" }, { status: 400 });
    }
    if (audio.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "Recording too large" }, { status: 413 });
    }
    const buf = Buffer.from(await audio.arrayBuffer());
    const mime = audio.type || "audio/webm";
    const ext = mime.includes("mp4") ? "m4a" : "webm";
    const audioUrl = await saveFile("audio", ext, buf, mime);
    const [created] = await db.insert(entries).values({ babyId: baby.id, audioUrl }).returning();

    try {
      const a = await analyzeVoiceNote(buf, mime);
      const [ready] = await db.update(entries).set({
        transcript: a.transcript, title: a.title, summary: a.summary, quote: a.quote,
        isMilestone: a.is_milestone, milestoneType: a.milestone_type,
        photoPrompt: a.photo_prompt, inAlbum: a.is_milestone, status: "ready",
      }).where(eq(entries.id, created.id)).returning();
      return NextResponse.json({ entry: { ...ready, photos: [] } });
    } catch (err) {
      console.error("AI processing failed", err);
      const [failed] = await db.update(entries).set({ status: "failed" })
        .where(eq(entries.id, created.id)).returning();
      return NextResponse.json({ entry: { ...failed, photos: [] } });
    }
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { baby, db } = await requireBaby();
    const list = await db.select().from(entries)
      .where(eq(entries.babyId, baby.id)).orderBy(desc(entries.recordedAt));
    const ids = list.map((e: typeof entries.$inferSelect) => e.id);
    const pics = ids.length
      ? await db.select().from(photos).where(inArray(photos.entryId, ids))
      : [];
    const withPhotos = list.map((e: typeof entries.$inferSelect) => ({
      ...e,
      photos: pics.filter((p: typeof photos.$inferSelect) => p.entryId === e.id),
    }));
    return NextResponse.json({ entries: withPhotos, baby });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Single-entry route (edit / toggle / delete)**

`app/api/entries/[id]/route.ts`:
- `PATCH` `{ title?, summary?, inAlbum? }` — only these three fields, only on the user's own entry (verify `babyId` matches).
- `DELETE` — deletes entry (photos cascade).

```ts
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { entries } from "@/lib/schema";
import { requireBaby } from "@/lib/guard";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { baby, db } = await requireBaby();
    const { id } = await params;
    const body = await req.json();
    const patch: Partial<typeof entries.$inferInsert> = {};
    if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim();
    if (typeof body.summary === "string" && body.summary.trim()) patch.summary = body.summary.trim();
    if (typeof body.inAlbum === "boolean") patch.inAlbum = body.inAlbum;
    if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    const [updated] = await db.update(entries).set(patch)
      .where(and(eq(entries.id, id), eq(entries.babyId, baby.id))).returning();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ entry: updated });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { baby, db } = await requireBaby();
    const { id } = await params;
    const deleted = await db.delete(entries)
      .where(and(eq(entries.id, id), eq(entries.babyId, baby.id))).returning();
    if (!deleted.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Retry route**

`app/api/entries/[id]/retry/route.ts` — `POST`: for a `failed` entry, re-fetch the stored audio (disk path or blob URL), re-run `analyzeVoiceNote`, update like the create path. For local URLs (`/api/files/...`) read from disk directly; for remote blob URLs use `fetch`.

```ts
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { and, eq } from "drizzle-orm";
import { entries } from "@/lib/schema";
import { requireBaby } from "@/lib/guard";
import { analyzeVoiceNote } from "@/lib/ai";

async function loadAudio(url: string): Promise<Buffer> {
  if (url.startsWith("/api/files/")) {
    const rel = url.replace("/api/files/", "");
    return fs.readFile(path.join(process.cwd(), ".data", "uploads", ...rel.split("/")));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load audio: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { baby, db } = await requireBaby();
    const { id } = await params;
    const [entry] = await db.select().from(entries)
      .where(and(eq(entries.id, id), eq(entries.babyId, baby.id)));
    if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const buf = await loadAudio(entry.audioUrl);
    const mime = entry.audioUrl.endsWith(".m4a") ? "audio/mp4" : "audio/webm";
    try {
      const a = await analyzeVoiceNote(buf, mime);
      const [ready] = await db.update(entries).set({
        transcript: a.transcript, title: a.title, summary: a.summary, quote: a.quote,
        isMilestone: a.is_milestone, milestoneType: a.milestone_type,
        photoPrompt: a.photo_prompt, inAlbum: a.is_milestone, status: "ready",
      }).where(eq(entries.id, id)).returning();
      return NextResponse.json({ entry: ready });
    } catch (err) {
      console.error("AI retry failed", err);
      return NextResponse.json({ error: "Processing failed again" }, { status: 502 });
    }
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 6: Photos route**

`app/api/entries/[id]/photos/route.ts` — `POST` (multipart, `photo` file(s)): validate image type + ≤15MB each, `saveFile("photos", ...)` at original resolution, insert rows, return them:

```ts
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { entries, photos } from "@/lib/schema";
import { requireBaby } from "@/lib/guard";
import { saveFile } from "@/lib/storage";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { baby, db } = await requireBaby();
    const { id } = await params;
    const [entry] = await db.select().from(entries)
      .where(and(eq(entries.id, id), eq(entries.babyId, baby.id)));
    if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const form = await req.formData();
    const files = form.getAll("photo").filter((f): f is File => f instanceof File);
    if (!files.length) return NextResponse.json({ error: "Photo required" }, { status: 400 });
    const saved = [];
    for (const f of files) {
      const ext = EXT[f.type];
      if (!ext) return NextResponse.json({ error: `Unsupported type ${f.type}` }, { status: 400 });
      if (f.size > 15 * 1024 * 1024) return NextResponse.json({ error: "Photo too large" }, { status: 413 });
      const url = await saveFile("photos", ext, Buffer.from(await f.arrayBuffer()), f.type);
      const [row] = await db.insert(photos).values({ entryId: id, blobUrl: url }).returning();
      saved.push(row);
    }
    return NextResponse.json({ photos: saved });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 7: Build check**

Run: `npm run build`
Expected: compiles clean.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: baby, entries, photos, and retry API routes"
```

---

### Task 8: App shell, onboarding + journal screen (record → entry flow)

**Files:**
- Create: `app/onboarding/page.tsx`, `components/Recorder.tsx`, `components/EntryCard.tsx`, `components/PhotoUploader.tsx`, `components/JournalClient.tsx`, `components/Nav.tsx`
- Modify: `app/page.tsx`, `app/layout.tsx`, `app/globals.css`

- [ ] **Step 1: Layout + theme**

`app/layout.tsx`: load Fraunces + Outfit via `next/font/google`, set metadata (title "Voice Baby Album", description, `themeColor #FAF6F0`, manifest link). `app/globals.css`: Tailwind v4 `@theme` block defining the palette tokens (`--color-milk`, `--color-ink`, `--color-apricot`, `--color-sage`) and font variables.

- [ ] **Step 2: Home page gate**

`app/page.tsx` (server component): `getUserId()` → no session ⇒ `redirect("/signin")`; no baby ⇒ `redirect("/onboarding")`; else render `<JournalClient baby={baby} />` plus `<Nav active="journal" />`.

- [ ] **Step 3: Onboarding page**

`app/onboarding/page.tsx` — client component: warm welcome ("Who are we celebrating?"), name input, date input (native `<input type="date">`), POST to `/api/baby`, then `router.push("/")`. Single screen, single button.

- [ ] **Step 4: Recorder component**

`components/Recorder.tsx` — client component built on MediaRecorder:
- Picks mimeType: prefers `audio/mp4` (Safari), falls back to `audio/webm;codecs=opus`.
- States: `idle` → `recording` (pulsing ring animation, elapsed timer) → `uploading`.
- Tap to start, tap to stop. On stop, `onRecorded(blob, mimeType)` callback.
- Mic-permission denial shows a friendly inline message with browser guidance.
- The hero button: ~96px circle, apricot, soft shadow, CSS-only pulse while recording.

- [ ] **Step 5: Journal client**

`components/JournalClient.tsx`:
- Fetches `/api/entries` on mount; keeps `entries` state.
- On `onRecorded`: prepend a local optimistic "thinking" card (spinner + "Listening to your note…"), POST FormData to `/api/entries`, replace the card with the returned entry (ready or failed).
- Renders `EntryCard` list below the recorder, most recent first.

- [ ] **Step 6: EntryCard component**

`components/EntryCard.tsx` — per entry:
- Ready: title (Fraunces), date, summary, quote styled as pull-quote ("…"), milestone badge (sage pill "✨ milestone") when `isMilestone`, `<audio controls>` for playback, photo thumbnails grid, photo prompt banner with `PhotoUploader` when no photos yet, in-album toggle (labelled "In album"), overflow menu with Edit (inline title/summary inputs → PATCH) and Delete (confirm → DELETE).
- Failed: "Couldn't process this note — your recording is safe." + Retry button → POST retry, update card.

- [ ] **Step 7: PhotoUploader component**

`components/PhotoUploader.tsx`: `<input type="file" accept="image/*" capture="environment" multiple hidden>` behind a friendly button ("Add a photo 📷"), POSTs to `/api/entries/[id]/photos`, calls `onAdded(photos)`.

- [ ] **Step 8: Nav component**

`components/Nav.tsx`: fixed bottom tab bar — "Journal" (mic icon) and "Album" (book icon), active state in apricot, plus small sign-out in a corner of the header.

- [ ] **Step 9: Verify in browser**

Run dev server; sign in via dev link; complete onboarding; record a note (mock AI returns "First big laugh"); confirm thinking state → ready card → photo prompt → add photo → toggle album.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat: onboarding and journal screen with recorder and entry cards"
```

---

### Task 9: Album timeline screen

**Files:**
- Create: `app/album/page.tsx`, `components/AlbumClient.tsx`

- [ ] **Step 1: Album page gate**

`app/album/page.tsx` (server component): same auth/baby gate as home; renders `<AlbumClient baby={baby} />` + `<Nav active="album" />`.

- [ ] **Step 2: AlbumClient**

`components/AlbumClient.tsx`:
- Fetches `/api/entries`; filter `status === "ready"`.
- "Show everything" toggle: off (default) → only `inAlbum` entries; on → all ready entries (non-album ones rendered slightly muted).
- Group by `monthNumber(baby.birthdate, entry.recordedAt)`, ascending; section headers via `monthLabel` (sticky, Fraunces).
- Entry rendering: album-page feel — title, date ("June 3"), summary, pull-quote, photos in a 2-up grid (`object-cover rounded-2xl`), milestone badge. In-album toggle available here too (so users can curate from the album view, incl. removing entries — spec's "remove some entries or pages").
- Empty state (no album entries yet): warm illustration text — "Your album begins with your first note. Go record one 🎙".
- Header: baby's name in Fraunces italic + age ("7 months old").

- [ ] **Step 3: Verify in browser**

Record 2+ notes (mock AI marks them milestones → in album), check grouping under "Month N — X" header, toggle one out of the album, verify "show everything" reveals it muted.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: album timeline grouped by month of life"
```

---

### Task 10: PWA manifest + polish pass

**Files:**
- Create: `app/manifest.ts`, `public/icon.svg` (+ generated PNGs 192/512)
- Modify: `app/layout.tsx` (viewport/theme), any components needing polish

- [ ] **Step 1: Manifest**

`app/manifest.ts`:

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Voice Baby Album",
    short_name: "BabyAlbum",
    description: "Your baby's first year, told in your own voice.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF6F0",
    theme_color: "#FAF6F0",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
```

- [ ] **Step 2: Icon**

Draw `public/icon.svg` (apricot circle, white mic + tiny heart), rasterize to `icon-192.png` / `icon-512.png` (macOS: `qlmanage -t -s 512 -o .` or `rsvg-convert`; fallback: write a tiny Node script with no new deps is NOT available — if no rasterizer exists on the machine, install `sharp` as a dev dep and convert with a one-off script, then uninstall).

- [ ] **Step 3: Polish pass**

Sweep all screens on a 375px viewport: spacing, tap targets ≥44px, load animation (staggered fade-up on entry cards via `animation-delay`), audio player styling, focus states, empty states, error toasts consistent.

- [ ] **Step 4: Full test + build**

Run: `npm test && npm run build`
Expected: all tests pass, build clean.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: PWA manifest, icons, and mobile polish"
```

---

### Task 11: End-to-end verification + README

**Files:**
- Create: `README.md`, `.env.example`

- [ ] **Step 1: Browser walkthrough (mobile viewport)**

Full flow in the in-app browser at 375×812: signin → dev link → onboarding → record → thinking → ready entry → photo add → album toggle → album screen grouping → edit entry → delete entry → failed/retry path (temporarily force `analyzeVoiceNote` to throw via env `AI_FORCE_FAIL=1` check in mock branch — add this: in dev mock, `if (process.env.AI_FORCE_FAIL) throw new Error("forced")`).

- [ ] **Step 2: `.env.example`**

```
# All optional — the app runs fully local without any of these.
# DATABASE_URL=postgres://...        # Neon (production)
# BLOB_READ_WRITE_TOKEN=...          # Vercel Blob (production)
# GEMINI_API_KEY=...                 # Google AI Studio key (real AI; free tier)
# GEMINI_MODEL=gemini-2.5-flash
# RESEND_API_KEY=...                 # magic-link emails (production)
# AUTH_SECRET=...                    # long random string (production)
# APP_URL=https://...                # canonical URL for magic links (production)
```

- [ ] **Step 3: README**

Short: what it is, local dev (`npm install && npm run dev` — zero config), how prod env vars flip on Neon/Blob/Gemini/Resend, deploy note (`vercel deploy`).

- [ ] **Step 4: Final commit**

```bash
git add -A && git commit -m "docs: README and env example; verified end-to-end flow"
```

---

## Self-review notes

- **Spec coverage:** channel/PWA (T1, T10), recording UX (T8), AI pipeline + failure handling (T6, T7), data model (T2), month grouping (T3, T9), album membership rules + curation (T7 PATCH, T8/T9 toggles), photo prompts + originals (T7/T8, storage keeps originals), auth + onboarding (T4, T7, T8), print-readiness (structural: month sections + original-resolution photos — no task needed, v2), error handling (T4 expired links, T7 failed/retry, T8 mic denial), testing (T3, T6 unit; T11 manual). No gaps.
- **Type consistency:** `EntryAnalysis` fields used identically in T6/T7; `monthNumber/monthLabel` signatures match T3↔T9; `saveFile(folder, ext, data, contentType)` matches T5↔T7.
- **Placeholders:** UI component steps (T8/T9) describe behavior + exact props/endpoints rather than full JSX — acceptable as the visual design is intentionally left to the implementing agent with the design direction block; all logic-bearing code is spelled out.
