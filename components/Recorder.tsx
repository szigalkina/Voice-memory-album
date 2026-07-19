"use client";

import { useEffect, useRef, useState } from "react";

type RecorderState = "idle" | "recording" | "denied" | "unsupported";

const PROMPTS = [
  "tap and tell today's little story",
  "what made you both smile today?",
  "any tiny firsts to remember?",
  "what did those little hands discover?",
  "one moment you never want to forget?",
  "what sound did you hear today, a giggle, a babble?",
];

const BAR_COUNT = 9;

export default function Recorder({
  onRecorded,
  uploading,
}: {
  onRecorded: (blob: Blob, mimeType: string) => void;
  uploading: boolean;
}) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [promptIdx, setPromptIdx] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(4));
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window !== "undefined" && !("MediaRecorder" in window)) {
      setState("unsupported");
    }
    setPromptIdx(Math.floor(Math.random() * PROMPTS.length));
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => {});
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function pickMime(): string {
    for (const m of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"]) {
      if (MediaRecorder.isTypeSupported(m)) return m;
    }
    return "";
  }

  function startMeter(stream: MediaStream) {
    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const next: number[] = [];
        for (let i = 0; i < BAR_COUNT; i++) {
          const v = data[2 + i * 2] ?? 0;
          next.push(4 + Math.round((v / 255) * 28));
        }
        setLevels(next);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* meter unavailable — timer alone is fine */
    }
  }

  function stopMeter() {
    cancelAnimationFrame(rafRef.current);
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    setLevels(Array(BAR_COUNT).fill(4));
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
        stopMeter();
        const type = rec.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        setState("idle");
        setPromptIdx((i) => (i + 1) % PROMPTS.length);
        if (blob.size > 0) onRecorded(blob, type.split(";")[0]);
      };
      recorderRef.current = rec;
      rec.start();
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
      startMeter(stream);
      setState("recording");
    } catch {
      setState("denied");
    }
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
  }

  const mm = String(Math.floor(elapsed / 60));
  const ss = String(elapsed % 60).padStart(2, "0");

  if (state === "unsupported") {
    return (
      <p className="text-center text-sm text-ink-soft border border-hairline rounded-[2px] px-4 py-3">
        this browser can&rsquo;t record audio; try Safari or Chrome on your phone
      </p>
    );
  }

  // Idle glyph: the waveform mark in bone, on the ink circle
  const idleBars = [10, 18, 26, 18, 10];

  return (
    <div className="flex flex-col items-center gap-4">
      {state === "recording" ? (
        <button
          onClick={stop}
          aria-label="Stop recording"
          className="recording-breathe h-[88px] w-[88px] rounded-full bg-ink flex items-center justify-center active:scale-95 transition"
        >
          <span className="h-6 w-6 rounded-[1px] bg-bone" />
        </button>
      ) : (
        <button
          onClick={start}
          disabled={uploading}
          aria-label="Start recording"
          className="h-[88px] w-[88px] rounded-full bg-ink flex items-center justify-center transition active:scale-95 hover:scale-[1.03] disabled:opacity-40"
        >
          {uploading ? (
            <span className="h-8 w-8 rounded-full border border-bone/30 border-t-bone animate-spin" />
          ) : (
            <span className="flex items-end gap-[4px]" aria-hidden>
              {idleBars.map((h, i) => (
                <span key={i} className="w-[2px] bg-bone" style={{ height: `${h}px` }} />
              ))}
            </span>
          )}
        </button>
      )}

      <div className="h-10 flex items-center gap-[5px]" aria-hidden>
        {state === "recording" ? (
          levels.map((h, i) => (
            <span
              key={i}
              className="w-px bg-ink transition-[height] duration-75"
              style={{ height: `${h}px` }}
            />
          ))
        ) : (
          <span className="font-display italic text-[19px] text-ink-soft text-center px-6">
            {uploading ? "listening to your note…" : PROMPTS[promptIdx]}
          </span>
        )}
      </div>

      {state === "recording" && (
        <p className="label-caps text-ink -mt-2">
          {mm}:{ss} · tap to finish
        </p>
      )}

      {state === "denied" && (
        <p className="text-center text-sm border border-hairline rounded-[2px] px-4 py-3 max-w-xs text-ink-soft">
          we need microphone access to record. enable it for this site in your browser
          settings and try again.
        </p>
      )}
    </div>
  );
}
