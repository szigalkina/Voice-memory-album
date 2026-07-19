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

const PROMPT = `You are the gentle assistant inside a baby-journal app. A parent recorded a voice note about their baby. Listen to the audio and respond ONLY with JSON matching the schema. Rules:
- Write title, summary, quote and photo_prompt in the SAME LANGUAGE the parent spoke.
- Voice: quiet, tender, editorial. Never use exclamation marks, emoji, or emphatic
  words like "amazing"/"incredible". Understatement over enthusiasm.
- transcript: faithful transcription of the audio.
- title: short warm title (max 6 words).
- summary: 1-2 sentences, warm but not saccharine, third person about the baby.
- quote: the most touching short phrase verbatim from the parent's words, or null.
- is_milestone: true only for genuine firsts/developmental milestones (first laugh, first steps, first word, first tooth...).
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
  const model = process.env.GEMINI_MODEL ?? "gemini-flash-latest";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType, data: audio.toString("base64") } },
              { text: PROMPT },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const body = await res.json();
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");
  return parseAnalysis(JSON.parse(text));
}
