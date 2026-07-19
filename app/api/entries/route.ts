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
    const [created] = await db
      .insert(entries)
      .values({ babyId: baby.id, audioUrl })
      .returning();

    try {
      const a = await analyzeVoiceNote(buf, mime);
      const [ready] = await db
        .update(entries)
        .set({
          transcript: a.transcript,
          title: a.title,
          summary: a.summary,
          quote: a.quote,
          isMilestone: a.is_milestone,
          milestoneType: a.milestone_type,
          photoPrompt: a.photo_prompt,
          inAlbum: a.is_milestone,
          status: "ready",
        })
        .where(eq(entries.id, created.id))
        .returning();
      return NextResponse.json({ entry: { ...ready, photos: [] } });
    } catch (err) {
      // Recording is already saved — never lost. Mark failed for retry.
      console.error("AI processing failed", err);
      const [failed] = await db
        .update(entries)
        .set({ status: "failed" })
        .where(eq(entries.id, created.id))
        .returning();
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
    const list = await db
      .select()
      .from(entries)
      .where(eq(entries.babyId, baby.id))
      .orderBy(desc(entries.recordedAt));
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
