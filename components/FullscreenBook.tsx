"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { BookPage as BookPageData } from "@/lib/book";
import BookPage from "./BookPage";

// Immersive page viewer: tap an entry anywhere in the album to read it full
// screen; the right/left thirds (and the chevrons, and arrow keys) turn pages.
export default function FullscreenBook({
  pages,
  startIndex,
  onClose,
}: {
  pages: BookPageData[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const next = useCallback(
    () => setIndex((i) => Math.min(i + 1, pages.length - 1)),
    [pages.length]
  );
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [next, prev, onClose]);

  const page = pages[index];
  if (!page) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-ink/95 flex flex-col fade-up">
      <div className="flex justify-end px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <button onClick={onClose} className="label-caps text-bone/80 py-2">
          close
        </button>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center justify-center px-4">
        <button
          aria-label="Previous page"
          onClick={prev}
          className="absolute inset-y-0 left-0 w-1/3 z-10"
        />
        <button
          aria-label="Next page"
          onClick={next}
          className="absolute inset-y-0 right-0 w-1/3 z-10"
        />
        {/* fit the 3:4.1 page inside the free height, whichever is tighter */}
        <div style={{ width: "min(92vw, calc((100dvh - 150px) * 0.7317))" }}>
          <BookPage page={page} number={index + 1} />
        </div>
      </div>

      <div className="pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 flex items-center justify-center gap-8">
        <button
          onClick={prev}
          disabled={index === 0}
          aria-label="Previous page"
          className="text-bone/80 text-2xl leading-none px-4 py-1 disabled:opacity-25"
        >
          ‹
        </button>
        <span className="label-caps !text-[10px] text-bone/70">
          {index + 1} / {pages.length}
        </span>
        <button
          onClick={next}
          disabled={index === pages.length - 1}
          aria-label="Next page"
          className="text-bone/80 text-2xl leading-none px-4 py-1 disabled:opacity-25"
        >
          ›
        </button>
      </div>
    </div>,
    document.body
  );
}
