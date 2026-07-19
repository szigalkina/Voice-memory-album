"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function SignInForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [devLink, setDevLink] = useState<string | null>(null);
  const linkError = params.get("error");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDevLink(data.devLink ?? null);
      setState("sent");
    } catch {
      setState("error");
    }
  }

  return (
    <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm fade-up">
        <div className="text-center mb-10">
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

        {linkError && state === "idle" && (
          <p className="mb-4 rounded-2xl bg-blush px-4 py-3 text-sm text-center">
            That link {linkError === "expired" ? "expired" : "didn’t work"} — send yourself a
            fresh one below.
          </p>
        )}

        {state === "sent" ? (
          <div className="text-center rounded-3xl bg-white/70 border border-cream px-6 py-8 shadow-sm">
            <p className="text-2xl mb-2">💌</p>
            <p className="font-medium">Check your email</p>
            <p className="mt-1 text-sm text-ink-soft">
              We sent a sign-in link to <span className="font-medium">{email}</span>
            </p>
            {devLink && (
              <a
                href={devLink}
                className="mt-5 inline-block rounded-full bg-apricot px-5 py-3 text-white font-medium shadow-md active:scale-95 transition"
              >
                Dev mode: tap to sign in
              </a>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-2xl border border-cream bg-white/80 px-5 py-4 text-base outline-none focus:border-apricot focus:ring-2 focus:ring-apricot/30"
            />
            <button
              type="submit"
              disabled={state === "sending"}
              className="w-full rounded-2xl bg-apricot px-5 py-4 text-white text-base font-semibold shadow-md active:scale-[0.98] transition disabled:opacity-60"
            >
              {state === "sending" ? "Sending…" : "Send me a sign-in link"}
            </button>
            {state === "error" && (
              <p className="text-sm text-center text-apricot-deep">
                Something went wrong — try again?
              </p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
