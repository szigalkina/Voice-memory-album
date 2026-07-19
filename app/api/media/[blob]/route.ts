import { and, eq } from "drizzle-orm";
import { entries, photos } from "@/lib/schema";
import { requireBaby } from "@/lib/guard";
import { mediaResponse } from "@/lib/http";

// Authenticated gateway to private blob storage. Only serves a file if it
// belongs to the signed-in user's baby (as audio or photo). Supports Range
// requests — required for audio playback in Safari.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ blob: string }> }
) {
  try {
    const { baby, db } = await requireBaby();
    const { blob } = await params; // Next decodes the segment → raw blob URL
    const storedUrl = `/api/media/${encodeURIComponent(blob)}`;

    const [audio] = await db
      .select({ id: entries.id })
      .from(entries)
      .where(and(eq(entries.audioUrl, storedUrl), eq(entries.babyId, baby.id)));
    let owned = !!audio;
    if (!owned) {
      const [photo] = await db
        .select({ id: photos.id })
        .from(photos)
        .innerJoin(entries, eq(photos.entryId, entries.id))
        .where(and(eq(photos.blobUrl, storedUrl), eq(entries.babyId, baby.id)));
      owned = !!photo;
    }
    if (!owned) return new Response("Not found", { status: 404 });

    const { get } = await import("@vercel/blob");
    const res = await get(blob, { access: "private" });
    if (!res || res.statusCode !== 200 || !res.stream) {
      return new Response("Not found", { status: 404 });
    }
    const data = Buffer.from(await new Response(res.stream).arrayBuffer());
    return mediaResponse(
      data,
      res.blob?.contentType ?? "application/octet-stream",
      req.headers.get("range")
    );
  } catch (e) {
    if (e instanceof Response) return e;
    return new Response("Server error", { status: 500 });
  }
}
