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
function PhotoGrid({ photos }: { photos: Photo[] }) {
  if (photos.length === 1) {
    return (
      <div className="mx-auto w-[62%]">
        <Print photo={photos[0]} className="aspect-square" />
      </div>
    );
  }
  if (photos.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-2.5 w-[88%] mx-auto">
        {photos.map((p) => (
          <Print key={p.id} photo={p} className="aspect-square" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2 w-[64%] mx-auto">
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
          onClick={onEdit}
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
        <div className={`flex-1 flex flex-col px-6 ${page.monthLabel ? "pt-3" : "pt-8"} pb-6`}>
          <div className="text-center mb-4">
            <h3 className="font-display italic text-[24px] leading-tight">{entry.title}</h3>
            <p
              className={`font-hand text-[17px] leading-snug text-ink/75 mt-1.5 ${
                photos.length > 2 ? "line-clamp-3" : "line-clamp-4"
              }`}
            >
              {entry.summary}
            </p>
            {entry.isMilestone && (
              <div className="mt-1.5">
                <Milestone />
              </div>
            )}
          </div>
          <div className="flex-1 flex items-center">
            <div className="w-full">
              <PhotoGrid photos={photos} />
            </div>
          </div>
          <p className="label-caps !text-[9px] text-ink-soft text-center mt-3">
            {capsDate(entry.recordedAt)}
          </p>
        </div>
      ) : (
        <div className={`flex-1 flex flex-col px-8 ${page.monthLabel ? "pt-3" : "pt-9"} pb-8`}>
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            <h3 className="font-display italic text-[28px] leading-tight">{entry.title}</h3>
            <p className="font-hand text-[20px] leading-relaxed text-ink/75 line-clamp-[9]">
              {entry.summary}
            </p>
            {entry.isMilestone && <Milestone />}
          </div>
          {/* date: bottom middle, not glued to the edge — semi central */}
          <p className="label-caps !text-[9px] text-ink-soft text-center mb-7">
            {capsDate(entry.recordedAt)}
          </p>
        </div>
      )}

      <span className={`absolute bottom-2.5 ${numberSide} text-[9px] text-ink-soft/60`}>
        {number}
      </span>
    </div>
  );
}
