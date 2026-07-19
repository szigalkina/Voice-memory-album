"use client";

import { useCallback, useEffect, useState } from "react";
import type { Baby, Entry } from "@/lib/types";
import { monthNumber } from "@/lib/months";
import Recorder from "./Recorder";
import EntryCard from "./EntryCard";
import EditEntrySheet from "./EditEntrySheet";

function ageLabel(birthdate: string): string {
  const months = monthNumber(birthdate, new Date()) - 1;
  if (months < 1) return "brand new";
  if (months === 1) return "1 month old";
  return `${months} months old`;
}

export default function JournalClient({ baby }: { baby: Baby }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebrateId, setCelebrateId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);

  useEffect(() => {
    fetch("/api/entries")
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []))
      .catch(() => setEntries([]));
  }, []);

  const handleRecorded = useCallback(async (blob: Blob, mimeType: string) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      const ext = mimeType.includes("mp4") ? "m4a" : "webm";
      form.append("audio", new File([blob], `note.${ext}`, { type: mimeType }));
      const res = await fetch("/api/entries", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setEntries((prev) => [data.entry, ...(prev ?? [])]);
      if (data.entry.isMilestone && data.entry.status === "ready") {
        setCelebrateId(data.entry.id);
        setTimeout(() => setCelebrateId(null), 1600);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong — try again?");
    } finally {
      setUploading(false);
    }
  }, []);

  const update = useCallback((updated: Entry) => {
    setEntries((prev) => prev?.map((e) => (e.id === updated.id ? updated : e)) ?? null);
  }, []);

  const remove = useCallback((id: string) => {
    setEntries((prev) => prev?.filter((e) => e.id !== id) ?? null);
  }, []);

  return (
    <main className="relative z-10 mx-auto w-full max-w-md flex-1 px-4 pb-32">
      <header className="flex items-center justify-between pt-6 pb-2">
        <div>
          <h1 className="font-display text-2xl font-semibold">
            {baby.name}
            <span className="text-ink-soft font-normal">&rsquo;s journal</span>
          </h1>
          <p className="text-xs text-ink-soft mt-0.5">{ageLabel(baby.birthdate)}</p>
        </div>
        <form action="/api/auth/signout" method="post">
          <button className="text-xs text-ink-soft underline underline-offset-2">
            Sign out
          </button>
        </form>
      </header>

      <section className="py-6">
        <Recorder onRecorded={handleRecorded} uploading={uploading} />
        {error && (
          <p className="mt-3 text-center text-sm rounded-2xl bg-blush px-4 py-3">{error}</p>
        )}
      </section>

      <section className="space-y-4">
        {entries === null ? (
          <p className="text-center text-sm text-ink-soft py-8">Loading…</p>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 fade-up">
            <p className="text-3xl mb-2">🌱</p>
            <p className="text-ink-soft text-sm leading-relaxed">
              No memories yet.
              <br />
              Tap the mic and tell the first one.
            </p>
          </div>
        ) : (
          entries.map((e, i) => (
            <div key={e.id} style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}>
              <EntryCard
                entry={e}
                onChange={update}
                onDelete={remove}
                onEdit={setEditing}
                celebrate={celebrateId === e.id}
              />
            </div>
          ))
        )}
      </section>

      {editing && (
        <EditEntrySheet
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={update}
          onDeleted={remove}
        />
      )}
    </main>
  );
}
