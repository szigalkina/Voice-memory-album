"use client";

import { useState } from "react";
import Image from "next/image";
import type { Entry, Photo } from "@/lib/types";
import PhotoUploader from "./PhotoUploader";

function fmtDate(iso: string) {
  return new Date(iso)
    .toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

function MilestoneMark({ celebrate }: { celebrate: boolean }) {
  return (
    <span className="mt-3 flex items-center justify-start gap-3">
      <span
        className={`h-px w-6 bg-ink/40 origin-right ${celebrate ? "hairline-bloom" : ""}`}
      />
      <span className="label-caps text-ink">milestone</span>
      <span
        className={`h-px w-6 bg-ink/40 origin-left ${celebrate ? "hairline-bloom" : ""}`}
      />
    </span>
  );
}

export default function EntryCard({
  entry,
  onChange,
  onDelete,
  onEdit,
  celebrate = false,
}: {
  entry: Entry;
  onChange: (e: Entry) => void;
  onDelete: (id: string) => void;
  onEdit: (e: Entry) => void;
  celebrate?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) onChange({ ...entry, ...data.entry });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this memory? The recording will be gone too.")) return;
    const res = await fetch(`/api/entries/${entry.id}`, { method: "DELETE" });
    if (res.ok) onDelete(entry.id);
  }

  async function retry() {
    setBusy(true);
    try {
      const res = await fetch(`/api/entries/${entry.id}/retry`, { method: "POST" });
      const data = await res.json();
      if (res.ok) onChange({ ...entry, ...data.entry });
    } finally {
      setBusy(false);
    }
  }

  if (entry.status === "processing") {
    return (
      <div className="fade-up border border-hairline bg-paper rounded-[3px] p-5 flex items-center gap-4">
        <span className="h-5 w-5 shrink-0 rounded-full border border-ink/20 border-t-ink animate-spin" />
        <p className="text-ink-soft text-sm">listening to your note…</p>
      </div>
    );
  }

  if (entry.status === "failed") {
    return (
      <div className="fade-up border border-hairline bg-paper rounded-[3px] p-5">
        <p className="font-medium text-sm">Couldn&rsquo;t process this note</p>
        <p className="text-sm text-ink-soft mt-1">
          Your recording is safe; we just couldn&rsquo;t understand it right now.
        </p>
        <audio controls src={entry.audioUrl} className="mt-3 w-full h-10" preload="none" />
        <div className="mt-4 flex gap-4 items-center">
          <button
            onClick={retry}
            disabled={busy}
            className="bg-ink text-bone label-caps px-5 py-3 rounded-[2px] active:scale-[0.98] transition disabled:opacity-40"
          >
            {busy ? "retrying…" : "try again"}
          </button>
          <button
            onClick={remove}
            className="label-caps text-ink-soft underline underline-offset-4"
          >
            delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <article className="fade-up border border-hairline bg-paper rounded-[3px] p-6 relative z-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-caps text-ink-soft">{fmtDate(entry.recordedAt)}</p>
          <h3 className="mt-1.5 font-display text-[26px] font-medium leading-tight">
            {entry.title}
          </h3>
        </div>
        <div className="relative shrink-0">
          <button
            aria-label="Entry menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="h-9 w-9 text-ink-soft hover:text-ink flex items-center justify-center text-xl"
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 z-10 w-32 bg-paper border border-hairline rounded-[2px] overflow-hidden text-sm shadow-sm">
              <button
                className="block w-full px-4 py-2.5 text-left hover:bg-bone"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit(entry);
                }}
              >
                Edit
              </button>
              <button
                className="block w-full px-4 py-2.5 text-left text-umber hover:bg-bone"
                onClick={() => {
                  setMenuOpen(false);
                  remove();
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {entry.isMilestone && <MilestoneMark celebrate={celebrate} />}

      <p className="mt-3 text-[15px] leading-relaxed text-ink/90">{entry.summary}</p>
      {entry.quote && (
        <blockquote className="mt-3 font-hand text-[19px] text-ink-soft">
          “{entry.quote}”
        </blockquote>
      )}

      <audio controls src={entry.audioUrl} className="mt-4 w-full h-10" preload="none" />

      {entry.photos.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {entry.photos.map((p) => (
            <Image
              key={p.id}
              src={p.blobUrl}
              alt=""
              width={400}
              height={400}
              unoptimized
              className="aspect-square w-full rounded-[2px] border border-hairline object-cover"
            />
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-hairline pt-4">
        {entry.photos.length === 0 && entry.photoPrompt ? (
          <p className="text-xs text-ink-soft truncate italic font-display text-[15px]">
            {entry.photoPrompt}
          </p>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-4 shrink-0">
          <PhotoUploader
            entryId={entry.id}
            label={entry.photos.length ? "add" : "add a photo"}
            onAdded={(newPhotos: Photo[]) =>
              onChange({ ...entry, photos: [...entry.photos, ...newPhotos] })
            }
          />
          <label className="flex items-center gap-2 label-caps text-ink-soft select-none">
            <input
              type="checkbox"
              checked={entry.inAlbum}
              disabled={busy}
              onChange={(e) => patch({ inAlbum: e.target.checked })}
              className="h-3.5 w-3.5 accent-[#2b2622]"
            />
            in album
          </label>
        </div>
      </div>
    </article>
  );
}
