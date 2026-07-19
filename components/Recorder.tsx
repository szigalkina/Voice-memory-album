"use client";

import { useEffect, useRef, useState } from "react";

type RecorderState = "idle" | "recording" | "uploading" | "denied" | "unsupported";

export default function Recorder({
  onRecorded,
  uploading,
}: {
  onRecorded: (blob: Blob, mimeType: string) => void;
  uploading: boolean;
}) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && !("MediaRecorder" in window)) {
      setState("unsupported");
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function pickMime(): string {
    // Safari records audio/mp4; Chrome/Firefox do webm/opus.
    for (const m of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"]) {
      if (MediaRecorder.isTypeSupported(m)) return m;
    }
    return "";
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMime();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = rec.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        setState("idle");
        if (blob.size > 0) onRecorded(blob, type.split(";")[0]);
      };
      recorderRef.current = rec;
      rec.start();
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
      setState("recording");
    } catch {
      setState("denied");
    }
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(1, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  if (state === "unsupported") {
    return (
      <p className="text-center text-sm text-ink-soft rounded-2xl bg-blush px-4 py-3">
        This browser can&rsquo;t record audio — try Safari or Chrome on your phone.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {state === "recording" ? (
        <button
          onClick={stop}
          aria-label="Stop recording"
          className="recording-pulse h-24 w-24 rounded-full bg-apricot-deep text-white shadow-xl flex items-center justify-center active:scale-95 transition"
        >
          <span className="h-7 w-7 rounded bg-white" />
        </button>
      ) : (
        <button
          onClick={start}
          disabled={uploading}
          aria-label="Start recording"
          className="h-24 w-24 rounded-full bg-apricot text-white shadow-xl flex items-center justify-center text-4xl active:scale-95 transition disabled:opacity-50"
        >
          {uploading ? (
            <span className="h-8 w-8 rounded-full border-[3px] border-white/40 border-t-white animate-spin" />
          ) : (
            "🎙️"
          )}
        </button>
      )}
      <p className="text-sm text-ink-soft h-5">
        {state === "recording" ? (
          <span className="font-medium text-apricot-deep">
            {mm}:{ss} · tap to finish
          </span>
        ) : uploading ? (
          "Listening to your note…"
        ) : (
          "Tap and tell today's little story"
        )}
      </p>
      {state === "denied" && (
        <p className="text-center text-sm rounded-2xl bg-blush px-4 py-3 max-w-xs">
          We need microphone access to record. Enable it for this site in your browser
          settings and try again.
        </p>
      )}
    </div>
  );
}
