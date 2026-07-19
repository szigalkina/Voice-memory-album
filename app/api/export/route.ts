import React from "react";
import { desc, eq, inArray } from "drizzle-orm";
import { entries, photos } from "@/lib/schema";
import { requireBaby } from "@/lib/guard";
import { readStoredFile } from "@/lib/storage";
import { buildBookPages } from "@/lib/book";
import type { Entry } from "@/lib/types";

export const maxDuration = 120; // rendering + fetching photos can take a while

export async function GET(req: Request) {
  try {
    const { baby, db } = await requireBaby();
    const partParam = new URL(req.url).searchParams.get("part");
    const part: "all" | "interior" | "cover" =
      partParam === "interior" || partParam === "cover" ? partParam : "all";
    const list = await db
      .select()
      .from(entries)
      .where(eq(entries.babyId, baby.id))
      .orderBy(desc(entries.recordedAt));
    const ids = list.map((e: typeof entries.$inferSelect) => e.id);
    const pics = ids.length
      ? await db.select().from(photos).where(inArray(photos.entryId, ids))
      : [];
    const withPhotos: Entry[] = list
      .map((e: typeof entries.$inferSelect) => ({
        ...e,
        photos: pics.filter((p: typeof photos.$inferSelect) => p.entryId === e.id),
      }))
      .filter((e: Entry) => e.status === "ready" && e.inAlbum)
      .sort(
        (a: Entry, b: Entry) =>
          new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
      );

    if (!withPhotos.length) {
      return new Response("Nothing in the album yet", { status: 404 });
    }

    const pages = buildBookPages(withPhotos, baby.birthdate);

    // Load photo bytes; react-pdf renders JPEG/PNG (skip other formats).
    // The cover needs no images at all.
    const pdfPages = [];
    for (const page of part === "cover" ? [] : pages) {
      const images: string[] = [];
      for (const p of page.photos) {
        const file = await readStoredFile(p.blobUrl);
        if (!file) continue;
        if (!["image/jpeg", "image/png"].includes(file.contentType)) continue;
        images.push(`data:${file.contentType};base64,${file.data.toString("base64")}`);
      }
      pdfPages.push({ page, images });
    }

    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { AlbumPdf } = await import("@/lib/pdf");
    const doc = React.createElement(AlbumPdf, {
      babyName: baby.name,
      pages: part === "cover" ? [] : pdfPages,
      part,
    }) as React.ReactElement<import("@react-pdf/renderer").DocumentProps>;
    const buffer = await renderToBuffer(doc);

    const slug = baby.name.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-");
    const suffix = part === "all" ? "album" : part;
    const filename = `${slug}-${suffix}.pdf`;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("PDF export failed", e);
    return new Response("Export failed", { status: 500 });
  }
}
