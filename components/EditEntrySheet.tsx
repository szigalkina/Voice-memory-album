"use client";

import { useState } from "react";
import Image from "next/image";
import type { Entry } from "@/lib/types";
import PhotoUploader from "./PhotoUploader";

export default function EditEntrySheet({
  entry,
  onClose,
  onSaved,
  onDeleted,
}: {
  entry: Entry;
  onClose: () => void;
  onSaved: (e: Entry) => void;
  onDeleted: (id: string) => void;
}) {
  const [title, setTitle] = useState(entry.title ?? "");
  const [summary, setSummary] = useState(entry.summary ?? "");
  const [photos, setPhotos] = useState(entry.photos);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field =
    "w-full rounded-[2px] border border-hairline bg-paper px-4 py-3 outline-none focus:border-ink transition-colors";

  async function removePhoto(photoId: string) {
    const res = await fetch(`/api/entries/${entry.id}/photos/${photoId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      const next = photos.filter((p) => p.id !== photoId);
      setPhotos(next);
      onSaved({ ...entry, photos: next });
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, summary }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save");
      onSaved({ ...entry, ...data.entry, photos });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this memory? The recording will be gone too.")) return;
    const res = await fetch(`/api/entries/${entry.id}`, { method: "DELETE" });
    if (res.ok) {
      onDeleted(entry.id);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/50" />
      <div className="relative w-full max-w-md rounded-t-[6px] bg-bone border-t border-hairline p-6 pb-9 max-h-[88vh] overflow-y-auto fade-up">
        <div className="mx-auto mb-5 h-px w-10 bg-ink/25" />
        <h2 className="font-display italic text-[24px] mb-5">edit this page</h2>

        <label className="label-caps text-ink-soft block mb-1.5">title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} />

        <label className="label-caps text-ink-soft block mb-1.5 mt-5">message</label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={4}
          className={field}
        />

        <label className="label-caps text-ink-soft block mb-1.5 mt-5">
          photos <span className="normal-case tracking-normal">(the page shows up to 4)</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative">
              <Image
                src={p.blobUrl}
                alt=""
                width={200}
                height={200}
                unoptimized
                className="aspect-square w-full rounded-[2px] border border-hairline object-cover"
              />
              <button
                aria-label="Remove photo"
                onClick={() => removePhoto(p.id)}
                className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-ink text-bone text-xs active:scale-90"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <PhotoUploader
            entryId={entry.id}
            onAdded={(newPhotos) => {
              const next = [...photos, ...newPhotos];
              setPhotos(next);
              onSaved({ ...entry, photos: next });
            }}
          />
        </div>

        {error && <p className="mt-3 text-sm text-umber">{error}</p>}

        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={remove}
            className="label-caps text-umber underline underline-offset-4"
          >
            delete memory
          </button>
          <div className="flex gap-5 items-center">
            <button onClick={onClose} className="label-caps text-ink-soft">
              cancel
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="bg-ink text-bone label-caps px-6 py-3.5 rounded-[2px] active:scale-[0.98] transition disabled:opacity-40"
            >
              {busy ? "saving…" : "save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
