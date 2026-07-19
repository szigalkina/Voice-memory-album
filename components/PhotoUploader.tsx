"use client";

import { useRef, useState } from "react";
import type { Photo } from "@/lib/types";

export default function PhotoUploader({
  entryId,
  onAdded,
  label = "Add a photo 📷",
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
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        multiple
        hidden
        onChange={(e) => upload(e.target.files)}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="rounded-full bg-sage px-4 py-2 text-sm font-medium text-white shadow active:scale-95 transition disabled:opacity-60"
      >
        {busy ? "Uploading…" : label}
      </button>
      {error && <span className="ml-2 text-xs text-apricot-deep">{error}</span>}
    </span>
  );
}
