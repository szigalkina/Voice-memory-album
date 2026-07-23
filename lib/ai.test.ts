import { describe, it, expect } from "vitest";
import { parseAnalysis, mockAnalysis, geminiRequestBody, MODEL_CHAIN } from "./ai";

const good = {
  transcript: "Сегодня она первый раз засмеялась!",
  title: "Первый смех",
  summary: "Малышка сегодня первый раз громко засмеялась, глядя на собаку.",
  quote: "первый раз засмеялась",
  is_milestone: true,
  milestone_type: "first_laugh",
  photo_prompt: "Есть фото этого счастливого момента?",
};

describe("parseAnalysis", () => {
  it("accepts a complete valid object", () => {
    expect(parseAnalysis(good)).toEqual({ ...good, has_speech: true });
  });
  it("coerces missing optional fields to null and booleans to false", () => {
    const r = parseAnalysis({ transcript: "hi", title: "Hi", summary: "s" });
    expect(r.quote).toBeNull();
    expect(r.is_milestone).toBe(false);
    expect(r.milestone_type).toBeNull();
    expect(r.photo_prompt).toBeNull();
    expect(r.has_speech).toBe(true);
  });
  it("throws on missing required fields", () => {
    expect(() => parseAnalysis({ title: "no transcript" })).toThrow();
    expect(() => parseAnalysis(null)).toThrow();
    expect(() => parseAnalysis("string")).toThrow();
  });
  it("silent audio yields an explicit empty analysis, never invented content", () => {
    const r = parseAnalysis({ has_speech: false, transcript: "", title: "", summary: "" });
    expect(r.has_speech).toBe(false);
    expect(r.transcript).toBe("");
    expect(r.title).toBe("");
    expect(r.is_milestone).toBe(false);
  });
});

describe("mockAnalysis", () => {
  it("returns a valid analysis (round-trips through parseAnalysis)", () => {
    expect(() => parseAnalysis(mockAnalysis())).not.toThrow();
  });
});

describe("geminiRequestBody", () => {
  it("caps thinking by default (Gemini 3 models hang/crawl on audio+schema otherwise)", () => {
    const b = geminiRequestBody("QUJD", "audio/mp4", true);
    expect(b.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "low" });
    expect(b.generationConfig.responseMimeType).toBe("application/json");
    expect(b.generationConfig.responseSchema).toBeTruthy();
    expect(b.contents[0].parts[0].inlineData).toEqual({ mimeType: "audio/mp4", data: "QUJD" });
  });
  it("omits thinkingConfig when a model rejects it", () => {
    const b = geminiRequestBody("QUJD", "audio/mp4", false);
    expect(b.generationConfig.thinkingConfig).toBeUndefined();
  });
});

describe("MODEL_CHAIN", () => {
  it("always contains the pinned working model", () => {
    expect(MODEL_CHAIN.some((e) => e.model === "gemini-3-flash-preview")).toBe(true);
  });
  it("has no empty or duplicate entries", () => {
    expect(MODEL_CHAIN.every((e) => e.model.length > 0)).toBe(true);
    const keys = MODEL_CHAIN.map((e) => `${e.api}/${e.model}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
