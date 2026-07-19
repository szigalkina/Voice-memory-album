import { eq } from "drizzle-orm";
import { getUserId } from "./auth";
import { getDb } from "./db";
import { babies } from "./schema";

// Throw Response objects so route handlers can `catch` and return them.
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
