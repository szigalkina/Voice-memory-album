import Link from "next/link";

export default function Nav({ active }: { active: "journal" | "album" }) {
  const base = "flex-1 py-4 text-center label-caps transition-colors";
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 pb-[env(safe-area-inset-bottom)] bg-bone/95 backdrop-blur border-t border-hairline">
      <div className="mx-auto max-w-md flex">
        <Link
          href="/"
          className={`${base} ${active === "journal" ? "text-ink" : "text-ink-soft"}`}
        >
          Journal
          {active === "journal" && <span className="block mx-auto mt-1 h-px w-6 bg-ink" />}
        </Link>
        <Link
          href="/album"
          className={`${base} ${active === "album" ? "text-ink" : "text-ink-soft"}`}
        >
          Album
          {active === "album" && <span className="block mx-auto mt-1 h-px w-6 bg-ink" />}
        </Link>
      </div>
    </nav>
  );
}
