"use client";

import Image from "next/image";
import type { BookPage as BookPageData } from "@/lib/book";
import type { Photo } from "@/lib/types";

function capsDate(iso: string) {
  return new Date(iso)
    .toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    .toUpperCase();
}

// Printed-photo look: paper matte, hairline, sharp corners.
function Print({ photo, className = "" }: { photo: Photo; className?: string }) {
  return (
    <div className={`bg-paper p-1.5 border border-hairline rounded-[2px] shadow-sm ${className}`}>
      <Image
        src={photo.blobUrl}
        alt=""
        width={600}
        height={600}
        unoptimized
        className="w-full h-full object-cover"
      />
    </div>
  );
}

// Squares, 2x2 max. Grid scales with how many photos the moment has.
// Widths are capped by the AVAILABLE HEIGHT too (cqh = 1% of the photo
// area, which is a size container): long titles/messages used to leave less
// room than a width-only square needed, and the frames overflowed into the
// date zone at the page bottom.
function PhotoGrid({ photos }: { photos: Photo[] }) {
  if (photos.length === 1) {
    return (
      <div className="mx-auto w-[min(78%,98cqh)]">
        <Print photo={photos[0]} className="aspect-square" />
      </div>
    );
  }
  if (photos.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-2.5 w-[min(92%,196cqh)] mx-auto">
        {photos.map((p) => (
          <Print key={p.id} photo={p} className="aspect-square" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2 w-[min(78%,94cqh)] mx-auto">
      {photos.slice(0, 4).map((p, i) => (
        <Print
          key={p.id}
          photo={p}
          className={`aspect-square ${photos.length === 3 && i === 2 ? "col-span-2 w-1/2 mx-auto" : ""}`}
        />
      ))}
    </div>
  );
}

function Milestone() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="h-px w-5 bg-ink/35" />
      <span className="label-caps !text-[9px] text-ink-soft">milestone</span>
      <span className="h-px w-5 bg-ink/35" />
    </span>
  );
}

export default function BookPage({
  page,
  number,
  onEdit,
}: {
  page: BookPageData;
  number: number;
  onEdit?: () => void;
}) {
  const { entry, photos } = page;
  const numberSide = page.side === "left" ? "left-5" : "right-5";

  return (
    <div className="relative w-full aspect-[3/4.1] rounded-[2px] bg-paper shadow-[0_10px_30px_-12px_rgba(30,25,20,0.25)] border border-hairline overflow-hidden flex flex-col">
      {/* inner page edge, like the gutter of an open book */}
      <div
        className={`absolute inset-y-0 w-3 pointer-events-none ${
          page.side === "left"
            ? "right-0 bg-gradient-to-l from-ink/5 to-transparent"
            : "left-0 bg-gradient-to-r from-ink/5 to-transparent"
        }`}
      />

      {onEdit && (
        <button
          onClick={(e) => {
            // the whole page is tappable (fullscreen view) — edit must not
            // trigger that too
            e.stopPropagation();
            onEdit();
          }}
          aria-label="Edit this page"
          className="absolute top-3 right-3 z-10 label-caps !text-[9px] text-ink-soft underline underline-offset-4"
        >
          edit
        </button>
      )}

      {page.monthLabel && (
        <p className="pt-7 label-caps !text-[9px] text-ink-soft/80 text-center">
          {page.monthLabel.toUpperCase()}
        </p>
      )}

      {photos.length > 0 ? (
        <div className={`flex-1 flex flex-col px-6 ${page.monthLabel ? "pt-3" : "pt-8"} pb-16`}>
          {/* Photo pages are photo-first (owner 2026-07-22): only the
              highlight — a small caption title — and the images. The full
              message lives in the journal and on photoless pages. */}
          <div className="text-center mb-3">
            <h3 className="font-display italic text-[18px] leading-tight line-clamp-2">{entry.title}</h3>
            {entry.isMilestone && (
              <div className="mt-1">
                <Milestone />
              </div>
            )}
          </div>
          <div className="flex-1 min-h-0 [container-type:size]">
            <div className="h-full flex flex-col justify-center">
              <PhotoGrid photos={photos} />
            </div>
          </div>
        </div>
      ) : (
        <div className={`flex-1 flex flex-col px-8 ${page.monthLabel ? "pt-3" : "pt-9"} pb-16`}>
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            <h3 className="font-display italic text-[28px] leading-tight">{entry.title}</h3>
            <p className="font-hand text-[20px] leading-relaxed text-ink/75 line-clamp-[9]">
              {entry.summary}
            </p>
            {entry.isMilestone && <Milestone />}
          </div>
        </div>
      )}

      {/* THE date rule: identical font and identical position on every page —
          bottom middle, semi central, never in the content flow. Kept low
          (bottom-5) so it never crowds the photo frames above. */}
      <p className="absolute bottom-5 inset-x-0 label-caps !text-[9px] text-ink-soft text-center pointer-events-none">
        {capsDate(entry.recordedAt)}
      </p>

      <span className={`absolute bottom-2.5 ${numberSide} text-[9px] text-ink-soft/60`}>
        {number}
      </span>
    </div>
  );
}
