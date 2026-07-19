"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : "Something went wrong — try again?");
      setBusy(false);
    }
  }

  return (
    <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm fade-up">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🎙️</div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            Voice Baby Album
          </h1>
          <p className="mt-3 text-ink-soft leading-relaxed">
            Your baby&rsquo;s first year,
            <br />
            <em className="font-display">told in your own voice.</em>
          </p>
        </div>

        <div className="mb-4 flex rounded-full bg-white/80 border border-cream p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`flex-1 rounded-full py-2 transition ${
              mode === "login" ? "bg-apricot text-white shadow" : "text-ink-soft"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            className={`flex-1 rounded-full py-2 transition ${
              mode === "signup" ? "bg-apricot text-white shadow" : "text-ink-soft"
            }`}
          >
            Create account
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-2xl border border-cream bg-white/80 px-5 py-4 text-base outline-none focus:border-apricot focus:ring-2 focus:ring-apricot/30"
          />
          <input
            type="password"
            required
            minLength={mode === "signup" ? 8 : undefined}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "Password (8+ characters)" : "Password"}
            className="w-full rounded-2xl border border-cream bg-white/80 px-5 py-4 text-base outline-none focus:border-apricot focus:ring-2 focus:ring-apricot/30"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-apricot px-5 py-4 text-white text-base font-semibold shadow-md active:scale-[0.98] transition disabled:opacity-60"
          >
            {busy ? "One moment…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
          {error && <p className="text-sm text-center text-apricot-deep">{error}</p>}
        </form>
      </div>
    </main>
  );
}
