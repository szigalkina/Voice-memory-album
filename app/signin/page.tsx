"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import WaveMark from "@/components/WaveMark";

export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field =
    "w-full rounded-[2px] border border-hairline bg-paper px-5 py-4 text-base outline-none focus:border-ink transition-colors";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong, try again?");
      setBusy(false);
    }
  }

  const tab = (m: "login" | "signup", text: string) => (
    <button
      type="button"
      onClick={() => {
        setMode(m);
        setError(null);
      }}
      className={`label-caps pb-1.5 transition-colors ${
        mode === m ? "text-ink border-b border-ink" : "text-ink-soft border-b border-transparent"
      }`}
    >
      {text}
    </button>
  );

  return (
    <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm fade-up">
        <div className="text-center mb-10">
          <WaveMark className="mb-6" />
          <h1 className="font-display text-[38px] font-medium leading-tight tracking-tight">
            Voice Baby Album
          </h1>
          <p className="mt-2 font-display italic text-[19px] text-ink-soft">
            your baby&rsquo;s first year, told in your own voice
          </p>
        </div>

        <div className="mb-7 flex justify-center gap-8">
          {tab("login", "sign in")}
          {tab("signup", "create account")}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={field}
          />
          <input
            type="password"
            required
            minLength={mode === "signup" ? 8 : undefined}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "password (8+ characters)" : "password"}
            className={field}
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-ink text-bone label-caps py-4.5 rounded-[2px] active:scale-[0.99] transition disabled:opacity-40 py-4"
          >
            {busy ? "one moment…" : mode === "login" ? "sign in" : "create account"}
          </button>
          {error && <p className="text-sm text-center text-umber">{error}</p>}
        </form>
      </div>
    </main>
  );
}
