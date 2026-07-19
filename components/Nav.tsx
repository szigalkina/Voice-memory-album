import Link from "next/link";

export default function Nav({ active }: { active: "journal" | "album" }) {
  const base =
    "flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-2xl text-xs font-medium transition";
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-md px-4 pb-3">
        <div className="flex gap-1 rounded-3xl bg-white/90 backdrop-blur border border-cream shadow-lg p-1.5">
          <Link
            href="/"
            className={`${base} ${active === "journal" ? "bg-apricot text-white shadow" : "text-ink-soft"}`}
          >
            <span className="text-xl leading-none">🎙️</span>
            Journal
          </Link>
          <Link
            href="/album"
            className={`${base} ${active === "album" ? "bg-apricot text-white shadow" : "text-ink-soft"}`}
          >
            <span className="text-xl leading-none">📖</span>
            Album
          </Link>
        </div>
      </div>
    </nav>
  );
}
