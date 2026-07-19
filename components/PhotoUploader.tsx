"use client";

import { useRef, useState } from "react";
import type { Photo } from "@/lib/types";

export default function PhotoUploader({
  entryId,
  onAdded,
  label = "add a photo",
}: {
  entryId: string;
  onAdded: (photos: Photo[]) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    for (const f of Array.from(files)) form.append("photo", f);
    try {
      const res = await fetch(`/api/entries/${entryId}/photos`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      onAdded(data.photos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <span>
      {/* No `capture` attribute: phones offer the photo gallery (with camera
          as an option) and computers open a normal file picker. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => upload(e.target.files)}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="label-caps text-ink underline underline-offset-4 disabled:opacity-40"
      >
        {busy ? "uploading…" : label}
      </button>
      {error && <span className="ml-2 text-xs text-umber">{error}</span>}
    </span>
  );
}
