import { sql } from "drizzle-orm";
import * as schema from "./schema";

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

// Both drivers get the DDL one statement at a time — Neon's HTTP driver
// rejects multi-statement strings.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function bootstrap(db: any) {
  for (const stmt of DDL.split(";")) {
    if (stmt.trim()) await db.execute(sql.raw(stmt));
  }
  return db;
}

// The promise lives on globalThis: Next bundles this module separately per
// route entry, and two module copies must never open two PGlite instances
// against the same data directory (split-brain).
const g = globalThis as typeof globalThis & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  __vbaDbPromise?: Promise<any> | null;
};

export function getDb() {
  if (!g.__vbaDbPromise) {
    g.__vbaDbPromise = (async () => {
      if (process.env.DATABASE_URL) {
        const { drizzle } = await import("drizzle-orm/neon-http");
        return bootstrap(drizzle(process.env.DATABASE_URL, { schema }));
      }
      const { PGlite } = await import("@electric-sql/pglite");
      const { drizzle } = await import("drizzle-orm/pglite");
      const path = await import("path");
      const { promises: fs } = await import("fs");
      const dataDir = path.join(process.cwd(), ".data", "pglite");
      await fs.mkdir(dataDir, { recursive: true });
      const client = new PGlite(dataDir);
      return bootstrap(drizzle(client, { schema }));
    })().catch((err) => {
      g.__vbaDbPromise = null; // allow retry after a failed connect
      throw err;
    });
  }
  return g.__vbaDbPromise;
}
