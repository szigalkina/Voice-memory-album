import { describe, it, expect } from "vitest";
import { monthNumber, monthLabel } from "./months";

describe("monthNumber", () => {
  it("is 1 during the first month of life", () => {
    expect(monthNumber("2026-01-15", new Date("2026-01-15T10:00:00Z"))).toBe(1);
    expect(monthNumber("2026-01-15", new Date("2026-02-14T10:00:00Z"))).toBe(1);
  });
  it("rolls to 2 on the monthly anniversary", () => {
    expect(monthNumber("2026-01-15", new Date("2026-02-15T10:00:00Z"))).toBe(2);
  });
  it("handles birthdays late in the month (Jan 31 -> Feb)", () => {
    // Feb has no 31st; Feb 28 is still month 1, Mar 1 is month 2
    expect(monthNumber("2026-01-31", new Date("2026-02-28T10:00:00Z"))).toBe(1);
    expect(monthNumber("2026-01-31", new Date("2026-03-01T10:00:00Z"))).toBe(2);
  });
  it("clamps to 1 for entries dated before birth", () => {
    expect(monthNumber("2026-01-15", new Date("2026-01-01T10:00:00Z"))).toBe(1);
  });
});

describe("monthLabel", () => {
  it("formats as 'Month N — MonthName'", () => {
    expect(monthLabel("2026-01-15", 1)).toBe("Month 1 — January");
    expect(monthLabel("2026-01-15", 3)).toBe("Month 3 — March");
    expect(monthLabel("2026-11-15", 3)).toBe("Month 3 — January");
  });
});
