"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { Baby, Entry } from "@/lib/types";
import { currentMonthLabel, monthLabel, monthNumber } from "@/lib/months";
import { buildBookPages } from "@/lib/book";
import BookPage from "./BookPage";
import EditEntrySheet from "./EditEntrySheet";
import FullscreenBook from "./FullscreenBook";
import WaveMark from "./WaveMark";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

export default function AlbumClient({ baby }: { baby: Baby }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [view, setView] = useState<"book" | "list">("book");
  const [showAll, setShowAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [title, setTitle] = useState<string | null>(baby.title ?? null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/entries")
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []))
      .catch(() => setEntries([]));
    fetch("/api/share")
      .then((r) => r.json())
      .then((d) => setShareUrl(d.url ?? null))
      .catch(() => {});
  }, []);

  async function createShare() {
    setShareBusy(true);
    try {
      const res = await fetch("/api/share", { method: "POST" });
      const data = await res.json();
      if (res.ok) setShareUrl(data.url);
    } finally {
      setShareBusy(false);
    }
  }

  async function revokeShare() {
    setShareBusy(true);
    try {
      const res = await fetch("/api/share", { method: "DELETE" });
      if (res.ok) setShareUrl(null);
    } finally {
      setShareBusy(false);
    }
  }

  async function copyShare() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the url is visible to copy manually */
    }
  }

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

  const albumAscending = useMemo(
    () =>
      (entries ?? [])
        .filter((e) => e.status === "ready" && e.inAlbum)
        .sort(
          (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
        ),
    [entries]
  );

  const pages = useMemo(
    () => buildBookPages(albumAscending, baby.birthdate),
    [albumAscending, baby.birthdate]
  );

  const listSections = useMemo(() => {
    if (!entries) return [];
    const ready = entries.filter((e) => e.status === "ready" && (showAll || e.inAlbum));
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

  // The list view can show entries the book doesn't (not in album) — build
  // pages for exactly what's visible so tapping any entry opens full screen.
  const listPages = useMemo(
    () =>
      buildBookPages(
        listSections.flatMap((s) => s.entries),
        baby.birthdate
      ),
    [listSections, baby.birthdate]
  );
  const viewerPages = view === "book" ? pages : listPages;

  function openViewer(entryId: string) {
    const idx = viewerPages.findIndex((p) => p.entry.id === entryId);
    if (idx >= 0) setViewerIndex(idx);
  }

  async function saveTitle() {
    setEditingTitle(false);
    const next = titleDraft.trim() || null;
    if (next === title) return;
    const res = await fetch("/api/baby", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleDraft }),
    });
    if (res.ok) {
      const data = await res.json();
      setTitle(data.baby.title ?? null);
    }
  }

  const tab = (v: "book" | "list", text: string) => (
    <button
      onClick={() => setView(v)}
      className={`label-caps pb-1.5 transition-colors ${
        view === v ? "text-ink border-b border-ink" : "text-ink-soft border-b border-transparent"
      }`}
    >
      {text}
    </button>
  );

  return (
    <main className="relative z-10 mx-auto w-full max-w-md flex-1 pb-32">
      <header className="pt-9 pb-5 text-center px-5">
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveTitle();
              if (e.key === "Escape") setEditingTitle(false);
            }}
            placeholder={baby.name}
            className="w-full bg-transparent text-center font-display italic text-[30px] leading-tight outline-none border-b border-ink pb-1"
          />
        ) : (
          <button
            onClick={() => {
              setTitleDraft(title ?? "");
              setEditingTitle(true);
            }}
            title="Tap to rename the album"
            className="block w-full"
          >
            <h1 className="font-display italic text-[36px] leading-tight">
              {title ?? baby.name}
            </h1>
          </button>
        )}
        <p className="label-caps text-ink-soft mt-1">{currentMonthLabel(baby.birthdate)}</p>
        <div className="mt-6 flex items-center justify-center gap-8">
          {tab("book", "book")}
          {tab("list", "all entries")}
        </div>
      </header>

      {entries === null ? (
        <p className="text-center text-sm text-ink-soft py-8">loading…</p>
      ) : view === "book" ? (
        pages.length === 0 ? (
          <div className="text-center py-14 fade-up px-5">
            <WaveMark className="mb-5" />
            <p className="font-display italic text-[24px] leading-snug">
              your album begins
              <br />
              with your first note.
            </p>
          </div>
        ) : (
          <div className="fade-up">
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 px-8 pb-4 no-scrollbar">
              {pages.map((page, i) => (
                <div
                  key={page.entry.id}
                  className="snap-center shrink-0 w-[82%] cursor-pointer"
                  onClick={() => setViewerIndex(i)}
                >
                  <BookPage
                    page={page}
                    number={i + 1}
                    onEdit={() => setEditing(page.entry)}
                  />
                </div>
              ))}
              <div className="shrink-0 w-6" />
            </div>
            <p className="label-caps !text-[9px] text-ink-soft text-center mt-2">
              {pages.length} {pages.length === 1 ? "page" : "pages"} · swipe to turn
            </p>
            <div className="mt-7 text-center">
              <a
                href="/api/export"
                className="label-caps inline-block border border-ink px-6 py-3.5 rounded-[2px] text-ink active:scale-[0.98] transition"
              >
                export as pdf
              </a>
              <p className="mt-3 flex items-center justify-center gap-5">
                <a
                  href="/api/export?part=interior"
                  className="label-caps !text-[9px] text-ink-soft underline underline-offset-4"
                >
                  pages only
                </a>
                <a
                  href="/api/export?part=cover"
                  className="label-caps !text-[9px] text-ink-soft underline underline-offset-4"
                >
                  cover only
                </a>
              </p>
              <p className="text-[11px] text-ink-soft mt-3 px-8 leading-relaxed">
                print services that accept PDFs (Blurb, PrestoPhoto, Mixam…) take the
                pages file and let you design the cover in their own editor
              </p>

              <div className="mt-10 border-t border-hairline pt-8 mx-8">
                {shareUrl ? (
                  <div className="fade-up">
                    <p className="label-caps text-ink mb-3">the book is shared</p>
                    <p className="text-[12px] text-ink-soft break-all border border-hairline rounded-[2px] bg-paper px-3 py-2.5 select-all">
                      {shareUrl}
                    </p>
                    <div className="mt-3 flex items-center justify-center gap-6">
                      <button
                        onClick={copyShare}
                        className="label-caps text-ink underline underline-offset-4"
                      >
                        {copied ? "copied" : "copy link"}
                      </button>
                      <button
                        onClick={revokeShare}
                        disabled={shareBusy}
                        className="label-caps text-umber underline underline-offset-4 disabled:opacity-40"
                      >
                        stop sharing
                      </button>
                    </div>
                    <p className="text-[11px] text-ink-soft mt-3 leading-relaxed">
                      anyone with this link can view the book — nothing else, no
                      account needed. stop sharing kills the link instantly.
                    </p>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={createShare}
                      disabled={shareBusy}
                      className="label-caps text-ink underline underline-offset-4 disabled:opacity-40"
                    >
                      {shareBusy ? "one moment…" : "share the book"}
                    </button>
                    <p className="text-[11px] text-ink-soft mt-2.5 leading-relaxed">
                      creates a private view-only link for grandparents and friends
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="px-5">
          <label className="mb-5 flex items-center justify-center gap-2 label-caps text-ink-soft select-none">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#2b2622]"
            />
            show everything
          </label>
          {listSections.length === 0 ? (
            <p className="text-center text-sm text-ink-soft py-10">nothing here yet</p>
          ) : (
            <div className="space-y-10">
              {listSections.map((section) => (
                <section key={section.month}>
                  <h2 className="sticky top-0 z-10 -mx-5 bg-bone/95 backdrop-blur px-5 py-3 label-caps text-ink">
                    {section.label}
                  </h2>
                  <div className="space-y-4 mt-2">
                    {section.entries.map((e, i) => (
                      <article
                        key={e.id}
                        style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}
                        onClick={() => openViewer(e.id)}
                        className={`fade-up border border-hairline bg-paper rounded-[3px] p-5 cursor-pointer ${
                          e.inAlbum ? "" : "opacity-55"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="label-caps text-ink-soft">{fmtDate(e.recordedAt)}</p>
                            <h3 className="mt-1 font-display text-[22px] font-medium leading-tight">
                              {e.title}
                            </h3>
                          </div>
                          {e.isMilestone && (
                            <span className="label-caps !text-[9px] text-ink-soft shrink-0 mt-1">
                              milestone
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-[14px] leading-relaxed text-ink/90">
                          {e.summary}
                        </p>
                        {e.photos.length > 0 && (
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            {e.photos.map((p) => (
                              <Image
                                key={p.id}
                                src={p.blobUrl}
                                alt=""
                                width={300}
                                height={300}
                                unoptimized
                                className="aspect-square w-full rounded-[2px] border border-hairline object-cover"
                              />
                            ))}
                          </div>
                        )}
                        <div className="mt-3 flex justify-end">
                          <button
                            disabled={busyId === e.id}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              toggleAlbum(e, !e.inAlbum);
                            }}
                            className="label-caps text-ink-soft underline underline-offset-4 disabled:opacity-40"
                          >
                            {e.inAlbum ? "remove from album" : "add to album"}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {viewerIndex !== null && viewerPages[viewerIndex] && (
        <FullscreenBook
          pages={viewerPages}
          startIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}

      {editing && (
        <EditEntrySheet
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) =>
            setEntries(
              (prev) => prev?.map((e) => (e.id === updated.id ? updated : e)) ?? null
            )
          }
          onDeleted={(id) =>
            setEntries((prev) => prev?.filter((e) => e.id !== id) ?? null)
          }
        />
      )}
    </main>
  );
}
