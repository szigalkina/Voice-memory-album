"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import WaveMark from "@/components/WaveMark";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [state, setState] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  const field =
    "w-full rounded-[2px] border border-hairline bg-paper px-5 py-4 outline-none focus:border-ink transition-colors";

  async function createAlbum(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setError(null);
    const res = await fetch("/api/baby", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, birthdate }),
    });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't save, check the fields and try again.");
      setState("idle");
    }
  }

  return (
    <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
      <form onSubmit={createAlbum} className="w-full max-w-sm fade-up">
        <div className="text-center mb-9">
          <WaveMark className="mb-6" />
          <h1 className="font-display italic text-[32px] leading-tight">
            who are we celebrating?
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            the birth date organizes the album by month of life
          </p>
        </div>
        <label className="label-caps text-ink-soft block mb-1.5">baby&rsquo;s name</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Mila" className={field} />
        <label className="label-caps text-ink-soft block mb-1.5 mt-5">birth date</label>
        <input
          required
          type="date"
          value={birthdate}
          onChange={(e) => setBirthdate(e.target.value)}
          className={field}
        />
        <button
          type="submit"
          disabled={state === "saving"}
          className="mt-8 w-full bg-ink text-bone label-caps py-4 rounded-[2px] active:scale-[0.99] transition disabled:opacity-40"
        >
          {state === "saving" ? "saving…" : "start the album"}
        </button>
        {error && <p className="mt-4 text-sm text-center text-umber">{error}</p>}
      </form>
    </main>
  );
}
