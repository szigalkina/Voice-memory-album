import { describe, it, expect } from "vitest";
import { isStaleProcessing, STALE_PROCESSING_MS } from "./stale";

const t0 = Date.parse("2026-07-20T12:00:00.000Z");
const iso = "2026-07-20T12:00:00.000Z";

describe("isStaleProcessing", () => {
  it("fresh processing entry is not stale", () => {
    expect(isStaleProcessing("processing", iso, t0 + 60_000)).toBe(false);
  });
  it("processing entry past the threshold is stale", () => {
    expect(
      isStaleProcessing("processing", iso, t0 + STALE_PROCESSING_MS + 1000)
    ).toBe(true);
  });
  it("ready and failed entries are never stale", () => {
    expect(isStaleProcessing("ready", iso, t0 + STALE_PROCESSING_MS * 10)).toBe(false);
    expect(isStaleProcessing("failed", iso, t0 + STALE_PROCESSING_MS * 10)).toBe(false);
  });
});
