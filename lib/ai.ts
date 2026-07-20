export interface EntryAnalysis {
  transcript: string;
  title: string;
  summary: string;
  quote: string | null;
  is_milestone: boolean;
  milestone_type: string | null;
  photo_prompt: string | null;
}

export function parseAnalysis(raw: unknown): EntryAnalysis {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("AI response is not an object");
  }
  const o = raw as Record<string, unknown>;
  for (const k of ["transcript", "title", "summary"]) {
    if (typeof o[k] !== "string" || !o[k]) throw new Error(`AI response missing ${k}`);
  }
  const str = (k: string) => (typeof o[k] === "string" && o[k] ? (o[k] as string) : null);
  return {
    transcript: o.transcript as string,
    title: o.title as string,
    summary: o.summary as string,
    quote: str("quote"),
    is_milestone: o.is_milestone === true,
    milestone_type: str("milestone_type"),
    photo_prompt: str("photo_prompt"),
  };
}

export function mockAnalysis(): EntryAnalysis {
  return {
    transcript:
      "(dev mode) Today she laughed out loud for the very first time when the dog sneezed.",
    title: "First big laugh",
    summary:
      "She laughed out loud for the very first time today — set off by the dog sneezing.",
    quote: "laughed out loud for the very first time",
    is_milestone: true,
    milestone_type: "first_laugh",
    photo_prompt: "did you catch that giggle on camera? add a photo of this moment",
  };
}

const PROMPT = `You are the gentle assistant inside a memory-album app. Someone recorded a voice note about a moment they want to keep — often about their baby, sometimes a trip, a season, a person they love. Listen to the audio and respond ONLY with JSON matching the schema. Rules:
- Write title, summary, quote and photo_prompt in the SAME LANGUAGE the parent spoke.
- Voice: quiet, tender, editorial. Never use exclamation marks, emoji, or emphatic
  words like "amazing"/"incredible". Understatement over enthusiasm.
- transcript: faithful transcription of the audio.
- title: short warm title (max 6 words).
- summary: 1-2 sentences, warm but not saccharine, third person about whoever or whatever the note is about.
- quote: the most touching short phrase verbatim from the parent's words, or null.
- is_milestone: true only for genuine firsts and once-in-a-lifetime moments (first laugh, first steps, first word — or a first swim, a wedding day...).
- milestone_type: short snake_case tag when is_milestone is true, else null.
- photo_prompt: one friendly sentence inviting the parent to add a photo of this specific moment.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    transcript: { type: "STRING" },
    title: { type: "STRING" },
    summary: { type: "STRING" },
    quote: { type: "STRING", nullable: true },
    is_milestone: { type: "BOOLEAN" },
    milestone_type: { type: "STRING", nullable: true },
    photo_prompt: { type: "STRING", nullable: true },
  },
  required: ["transcript", "title", "summary", "is_milestone"],
};

// Models are tried in order until one answers. Rolling aliases have silently
// changed behavior before (gemini-flash-latest became a thinking model that
// hangs on audio+schema requests) — hence pinned primary + fallbacks + a hard
// per-attempt timeout so one bad model can never stall the whole request.
// Surveyed 2026-07-20: only gemini-3-flash-preview serves this key on v1beta
// (the -latest aliases 404 with empty bodies, most stable models are closed to
// new keys); v1alpha gemini-3.5-flash was the one other endpoint that answered
// at all, so it stays as a last resort.
export interface ChainEntry {
  model: string;
  api: "v1beta" | "v1alpha";
}

export const MODEL_CHAIN: ChainEntry[] = (
  [
    { model: process.env.GEMINI_MODEL ?? "", api: "v1beta" },
    { model: "gemini-3-flash-preview", api: "v1beta" },
    { model: "gemini-flash-lite-latest", api: "v1beta" },
    { model: "gemini-flash-latest", api: "v1beta" },
    { model: "gemini-3.5-flash", api: "v1alpha" },
  ] as ChainEntry[]
).filter(
  (e, i, a) =>
    e.model && a.findIndex((x) => x.model === e.model && x.api === e.api) === i
);

const ATTEMPT_TIMEOUT_MS = 45_000;
// Attempts stop once this much time has passed, so the route (maxDuration
// 300s) always survives to mark the entry failed instead of dying mid-chain
// and leaving it "processing" forever.
const TOTAL_BUDGET_MS = 200_000;

export function geminiRequestBody(
  audioB64: string,
  mimeType: string,
  capThinking: boolean
) {
  return {
    contents: [
      {
        parts: [
          { inlineData: { mimeType, data: audioB64 } },
          { text: PROMPT },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: SCHEMA,
      // Gemini 3 models default to heavy "thinking" on audio+schema requests
      // (measured 42s for a 4-second clip on 2026-07-20; ~3s with the cap).
      ...(capThinking
        ? { thinkingConfig: { thinkingLevel: "low" as const } }
        : {}),
    },
  };
}

// Thinking models can emit multiple parts (thoughts first) — find the JSON one.
function extractJsonText(body: unknown): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts = (body as any)?.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    if (typeof p?.text !== "string" || p.thought) continue;
    const text = p.text.replace(/^```json\s*|```\s*$/g, "").trim();
    try {
      JSON.parse(text);
      return text;
    } catch {
      continue;
    }
  }
  return null;
}

async function callModel(
  entry: ChainEntry,
  audioB64: string,
  mimeType: string,
  timeoutMs: number,
  capThinking = true
): Promise<EntryAnalysis> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/${entry.api}/models/${entry.model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify(geminiRequestBody(audioB64, mimeType, capThinking)),
    }
  );
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    // A model that doesn't understand thinkingConfig gets one plain retry.
    if (capThinking && res.status === 400 && /thinking/i.test(detail)) {
      return callModel(entry, audioB64, mimeType, timeoutMs, false);
    }
    throw new Error(`Gemini ${entry.model} error ${res.status}: ${detail}`);
  }
  const text = extractJsonText(await res.json());
  if (!text) throw new Error(`Gemini ${entry.model} returned no parseable JSON`);
  return parseAnalysis(JSON.parse(text));
}

export async function analyzeVoiceNote(
  audio: Buffer,
  mimeType: string
): Promise<EntryAnalysis> {
  if (!process.env.GEMINI_API_KEY) {
    // Dev mode: no key configured — deterministic mock with simulated latency.
    if (process.env.AI_FORCE_FAIL) throw new Error("forced AI failure (dev)");
    await new Promise((r) => setTimeout(r, 800));
    return mockAnalysis();
  }
  const audioB64 = audio.toString("base64");
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let lastError: unknown;
  for (const entry of MODEL_CHAIN) {
    const remaining = deadline - Date.now();
    if (remaining <= 5_000) {
      lastError = lastError ?? new Error("AI time budget exhausted");
      break;
    }
    try {
      return await callModel(
        entry,
        audioB64,
        mimeType,
        Math.min(ATTEMPT_TIMEOUT_MS, remaining)
      );
    } catch (err) {
      lastError = err;
      console.error(`AI model ${entry.model} (${entry.api}) failed:`, err);
    }
  }
  const { sendOpsAlert } = await import("./alert");
  await sendOpsAlert(
    "voice note processing is failing",
    `All models in the chain failed (${MODEL_CHAIN.map((e) => e.model).join(" → ")}).\nLast error: ${String(lastError).slice(0, 500)}\n\nUsers see "Couldn't process this note" and can retry once this is fixed.`
  );
  throw lastError;
}
