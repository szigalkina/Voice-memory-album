"use client";

import { useCallback, useEffect, useState } from "react";
import type { Baby, Entry } from "@/lib/types";
import { monthNumber } from "@/lib/months";
import Recorder from "./Recorder";
import EntryCard from "./EntryCard";
import EditEntrySheet from "./EditEntrySheet";
import WaveMark from "./WaveMark";

function ageLabel(birthdate: string): string {
  const months = monthNumber(birthdate, new Date()) - 1;
  if (months < 1) return "brand new";
  if (months === 1) return "one month old";
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
        setTimeout(() => setCelebrateId(null), 1800);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong, try again?");
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
    <main className="relative z-10 mx-auto w-full max-w-md flex-1 px-5 pb-32">
      <header className="flex items-end justify-between pt-8 pb-2">
        <div>
          <p className="label-caps text-ink-soft">the journal of</p>
          <h1 className="font-display italic text-[34px] leading-tight -mt-0.5">
            {baby.name}
          </h1>
          <p className="label-caps text-ink-soft mt-1">{ageLabel(baby.birthdate)}</p>
        </div>
        <form action="/api/auth/signout" method="post">
          <button className="label-caps text-ink-soft underline underline-offset-4 pb-1">
            sign out
          </button>
        </form>
      </header>

      <section className="py-8">
        <Recorder onRecorded={handleRecorded} uploading={uploading} />
        {error && (
          <p className="mt-4 text-center text-sm text-umber border border-hairline rounded-[2px] px-4 py-3">
            {error}
          </p>
        )}
      </section>

      <section className="space-y-4">
        {entries === null ? (
          <p className="text-center text-sm text-ink-soft py-8">loading…</p>
        ) : entries.length === 0 ? (
          <div className="text-center py-10 fade-up">
            <WaveMark className="mb-5" />
            <p className="font-display italic text-[22px] text-ink-soft leading-snug">
              no memories yet.
              <br />
              tap the circle and tell the first one.
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
