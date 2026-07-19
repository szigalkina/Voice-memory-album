"use client";

import { useState } from "react";
import Image from "next/image";
import type { Entry, Photo } from "@/lib/types";
import PhotoUploader from "./PhotoUploader";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

export default function EntryCard({
  entry,
  onChange,
  onDelete,
}: {
  entry: Entry;
  onChange: (e: Entry) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(entry.title ?? "");
  const [summary, setSummary] = useState(entry.summary ?? "");
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

  async function saveEdit() {
    await patch({ title, summary });
    setEditing(false);
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
      <div className="fade-up rounded-3xl bg-white/80 border border-cream p-5 shadow-sm flex items-center gap-4">
        <span className="h-6 w-6 shrink-0 rounded-full border-[3px] border-apricot/30 border-t-apricot animate-spin" />
        <p className="text-ink-soft">Listening to your note…</p>
      </div>
    );
  }

  if (entry.status === "failed") {
    return (
      <div className="fade-up rounded-3xl bg-white/80 border border-cream p-5 shadow-sm">
        <p className="font-medium">Couldn&rsquo;t process this note</p>
        <p className="text-sm text-ink-soft mt-1">
          Your recording is safe — we just couldn&rsquo;t understand it right now.
        </p>
        <audio controls src={entry.audioUrl} className="mt-3 w-full h-10" preload="none" />
        <div className="mt-3 flex gap-2">
          <button
            onClick={retry}
            disabled={busy}
            className="rounded-full bg-apricot px-4 py-2 text-sm font-medium text-white shadow active:scale-95 transition disabled:opacity-60"
          >
            {busy ? "Retrying…" : "Try again"}
          </button>
          <button onClick={remove} className="rounded-full px-4 py-2 text-sm text-ink-soft">
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <article className="fade-up rounded-3xl bg-white/80 border border-cream p-5 shadow-sm relative z-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-ink-soft">
            {fmtDate(entry.recordedAt)}
          </p>
          {editing ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-cream px-3 py-2 font-display text-xl"
            />
          ) : (
            <h3 className="mt-0.5 font-display text-2xl font-semibold leading-snug">
              {entry.title}
            </h3>
          )}
        </div>
        <div className="relative shrink-0">
          <button
            aria-label="Entry menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="h-9 w-9 rounded-full text-ink-soft hover:bg-cream flex items-center justify-center text-xl"
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 z-10 w-36 rounded-2xl bg-white border border-cream shadow-lg overflow-hidden text-sm">
              <button
                className="block w-full px-4 py-2.5 text-left hover:bg-milk"
                onClick={() => {
                  setEditing(true);
                  setMenuOpen(false);
                }}
              >
                ✏️ Edit
              </button>
              <button
                className="block w-full px-4 py-2.5 text-left text-apricot-deep hover:bg-milk"
                onClick={() => {
                  setMenuOpen(false);
                  remove();
                }}
              >
                🗑 Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {entry.isMilestone && (
        <span className="mt-2 inline-block rounded-full bg-sage/20 text-sage-deep px-3 py-1 text-xs font-semibold">
          ✨ milestone
        </span>
      )}

      {editing ? (
        <div className="mt-2">
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-cream px-3 py-2 text-[15px]"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={saveEdit}
              disabled={busy}
              className="rounded-full bg-apricot px-4 py-2 text-sm font-medium text-white shadow disabled:opacity-60"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-full px-4 py-2 text-sm text-ink-soft"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-2 text-[15px] leading-relaxed">{entry.summary}</p>
          {entry.quote && (
            <blockquote className="mt-3 border-l-[3px] border-apricot/50 pl-3 font-display italic text-ink-soft">
              “{entry.quote}”
            </blockquote>
          )}
        </>
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
              className="aspect-square w-full rounded-2xl object-cover"
            />
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-cream pt-3">
        {entry.photos.length === 0 && entry.photoPrompt ? (
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-xs text-ink-soft truncate">{entry.photoPrompt}</p>
          </div>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3 shrink-0">
          <PhotoUploader
            entryId={entry.id}
            label={entry.photos.length ? "＋ 📷" : "Add a photo 📷"}
            onAdded={(newPhotos: Photo[]) =>
              onChange({ ...entry, photos: [...entry.photos, ...newPhotos] })
            }
          />
          <label className="flex items-center gap-1.5 text-xs text-ink-soft select-none">
            <input
              type="checkbox"
              checked={entry.inAlbum}
              disabled={busy}
              onChange={(e) => patch({ inAlbum: e.target.checked })}
              className="h-4 w-4 accent-[#f49e6d]"
            />
            In album
          </label>
        </div>
      </div>
    </article>
  );
}
