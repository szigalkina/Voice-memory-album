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
