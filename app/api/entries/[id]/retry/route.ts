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
    const buf = await loadAudio(entry.audioUrl);
    const mime = entry.audioUrl.endsWith(".m4a") ? "audio/mp4" : "audio/webm";
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
