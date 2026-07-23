import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { entries } from "@/lib/schema";
import { requireBaby } from "@/lib/guard";
import { analyzeVoiceNote } from "@/lib/ai";
import { readStoredFile } from "@/lib/storage";

// The AI chain may legitimately run for minutes; without this the platform
// default killed the function mid-chain and entries stayed "processing" forever.
export const maxDuration = 300;

export async function POST(
  _req: Request,
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
    const file = await readStoredFile(entry.audioUrl);
    if (!file) return NextResponse.json({ error: "Audio unavailable" }, { status: 502 });
    const buf = file.data;
    const mime = file.contentType;
    try {
      const a = await analyzeVoiceNote(buf, mime);
      if (!a.has_speech || !a.transcript.trim()) {
        return NextResponse.json(
          { error: "We couldn't hear any words in this recording — you can delete it." },
          { status: 422 }
        );
      }
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
        .where(eq(entries.id, id))
        .returning();
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
