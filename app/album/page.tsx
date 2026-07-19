import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { babies } from "@/lib/schema";
import AlbumClient from "@/components/AlbumClient";
import Nav from "@/components/Nav";

export const dynamic = "force-dynamic";

export default async function AlbumPage() {
  const userId = await getUserId();
  if (!userId) redirect("/signin");
  const db = await getDb();
  const [baby] = await db.select().from(babies).where(eq(babies.userId, userId));
  if (!baby) redirect("/onboarding");
  return (
    <>
      <AlbumClient baby={{ id: baby.id, name: baby.name, birthdate: baby.birthdate }} />
      <Nav active="album" />
    </>
  );
}
