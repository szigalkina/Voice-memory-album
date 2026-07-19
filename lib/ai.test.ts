import { describe, it, expect } from "vitest";
import { parseAnalysis, mockAnalysis } from "./ai";

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
    expect(parseAnalysis(good)).toEqual(good);
  });
  it("coerces missing optional fields to null and booleans to false", () => {
    const r = parseAnalysis({ transcript: "hi", title: "Hi", summary: "s" });
    expect(r.quote).toBeNull();
    expect(r.is_milestone).toBe(false);
    expect(r.milestone_type).toBeNull();
    expect(r.photo_prompt).toBeNull();
  });
  it("throws on missing required fields", () => {
    expect(() => parseAnalysis({ title: "no transcript" })).toThrow();
    expect(() => parseAnalysis(null)).toThrow();
    expect(() => parseAnalysis("string")).toThrow();
  });
});

describe("mockAnalysis", () => {
  it("returns a valid analysis (round-trips through parseAnalysis)", () => {
    expect(() => parseAnalysis(mockAnalysis())).not.toThrow();
  });
});
