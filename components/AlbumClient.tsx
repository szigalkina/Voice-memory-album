"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { Baby, Entry } from "@/lib/types";
import { monthLabel, monthNumber } from "@/lib/months";

function ageLabel(birthdate: string): string {
  const months = monthNumber(birthdate, new Date()) - 1;
  if (months < 1) return "brand new";
  if (months === 1) return "1 month old";
  return `${months} months old`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

export default function AlbumClient({ baby }: { baby: Baby }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/entries")
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []))
      .catch(() => setEntries([]));
  }, []);

  async function toggleAlbum(entry: Entry, inAlbum: boolean) {
    setBusyId(entry.id);
    try {
      const res = await fetch(`/api/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inAlbum }),
      });
      if (res.ok) {
        setEntries(
          (prev) => prev?.map((e) => (e.id === entry.id ? { ...e, inAlbum } : e)) ?? null
        );
      }
    } finally {
      setBusyId(null);
    }
  }

  const sections = useMemo(() => {
    if (!entries) return [];
    const ready = entries.filter(
      (e) => e.status === "ready" && (showAll || e.inAlbum)
    );
    const byMonth = new Map<number, Entry[]>();
    for (const e of ready) {
      const m = monthNumber(baby.birthdate, new Date(e.recordedAt));
      if (!byMonth.has(m)) byMonth.set(m, []);
      byMonth.get(m)!.push(e);
    }
    return [...byMonth.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([m, list]) => ({
        month: m,
        label: monthLabel(baby.birthdate, m),
        entries: list.sort(
          (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
        ),
      }));
  }, [entries, showAll, baby.birthdate]);

  return (
    <main className="relative z-10 mx-auto w-full max-w-md flex-1 px-4 pb-32">
      <header className="pt-8 pb-4 text-center">
        <h1 className="font-display text-4xl font-semibold italic">{baby.name}</h1>
        <p className="mt-1 text-sm text-ink-soft">{ageLabel(baby.birthdate)}</p>
        <label className="mt-4 inline-flex items-center gap-2 text-xs text-ink-soft select-none">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="h-4 w-4 accent-[#9bb49a]"
          />
          Show everything, not just album pages
        </label>
      </header>

      {entries === null ? (
        <p className="text-center text-sm text-ink-soft py-8">Loading…</p>
      ) : sections.length === 0 ? (
        <div className="text-center py-14 fade-up">
          <p className="text-4xl mb-3">📖</p>
          <p className="font-display text-xl">Your album begins with your first note.</p>
          <p className="mt-2 text-sm text-ink-soft">Go record one 🎙</p>
        </div>
      ) : (
        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section.month}>
              <h2 className="sticky top-0 z-10 -mx-4 bg-milk/90 backdrop-blur px-4 py-3 font-display text-xl font-semibold text-ink">
                {section.label}
              </h2>
              <div className="space-y-5 mt-2">
                {section.entries.map((e, i) => (
                  <article
                    key={e.id}
                    style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}
                    className={`fade-up rounded-3xl border p-5 shadow-sm ${
                      e.inAlbum
                        ? "bg-white/85 border-cream"
                        : "bg-white/40 border-cream/60 opacity-70"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-ink-soft">
                          {fmtDate(e.recordedAt)}
                        </p>
                        <h3 className="mt-0.5 font-display text-2xl font-semibold leading-snug">
                          {e.title}
                        </h3>
                      </div>
                      {e.isMilestone && (
                        <span className="shrink-0 rounded-full bg-sage/20 text-sage-deep px-3 py-1 text-xs font-semibold">
                          ✨
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-[15px] leading-relaxed">{e.summary}</p>
                    {e.quote && (
                      <blockquote className="mt-3 border-l-[3px] border-apricot/50 pl-3 font-display italic text-ink-soft">
                        “{e.quote}”
                      </blockquote>
                    )}
                    {e.photos.length > 0 && (
                      <div
                        className={`mt-4 grid gap-2 ${
                          e.photos.length === 1 ? "grid-cols-1" : "grid-cols-2"
                        }`}
                      >
                        {e.photos.map((p) => (
                          <Image
                            key={p.id}
                            src={p.blobUrl}
                            alt=""
                            width={600}
                            height={600}
                            unoptimized
                            className={`w-full rounded-2xl object-cover ${
                              e.photos.length === 1 ? "aspect-[4/3]" : "aspect-square"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex justify-end">
                      <button
                        disabled={busyId === e.id}
                        onClick={() => toggleAlbum(e, !e.inAlbum)}
                        className="text-xs text-ink-soft underline underline-offset-2 disabled:opacity-50"
                      >
                        {e.inAlbum ? "Remove from album" : "Add to album"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
