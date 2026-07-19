import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { entries, photos } from "@/lib/schema";
import { requireBaby } from "@/lib/guard";
import { saveFile } from "@/lib/storage";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { baby, db } = await requireBaby();
    const { id } = await params;
    const [entry] = await db
      .select()
      .from(entries)
      .where(and(eq(entries.id, id), eq(entries.babyId, baby.id)));
    if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const form = await req.formData();
    const files = form.getAll("photo").filter((f): f is File => f instanceof File);
    if (!files.length) {
      return NextResponse.json({ error: "Photo required" }, { status: 400 });
    }
    const saved = [];
    for (const f of files) {
      const ext = EXT[f.type];
      if (!ext) {
        return NextResponse.json({ error: `Unsupported type ${f.type}` }, { status: 400 });
      }
      if (f.size > 15 * 1024 * 1024) {
        return NextResponse.json({ error: "Photo too large" }, { status: 413 });
      }
      // Original resolution preserved — print quality matters later.
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
