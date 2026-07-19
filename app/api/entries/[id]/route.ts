import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { entries } from "@/lib/schema";
import { requireBaby } from "@/lib/guard";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { baby, db } = await requireBaby();
    const { id } = await params;
    const body = await req.json();
    const patch: Partial<typeof entries.$inferInsert> = {};
    if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim();
    if (typeof body.summary === "string" && body.summary.trim()) {
      patch.summary = body.summary.trim();
    }
    if (typeof body.inAlbum === "boolean") patch.inAlbum = body.inAlbum;
    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }
    const [updated] = await db
      .update(entries)
      .set(patch)
      .where(and(eq(entries.id, id), eq(entries.babyId, baby.id)))
      .returning();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ entry: updated });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { baby, db } = await requireBaby();
    const { id } = await params;
    const deleted = await db
      .delete(entries)
      .where(and(eq(entries.id, id), eq(entries.babyId, baby.id)))
      .returning();
    if (!deleted.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
