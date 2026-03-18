import { describe, expect, it } from "vitest";
import { sanitizeDurationMs, sanitizePaddingFactor } from "../lib/settings";

describe("sanitizeDurationMs", () => {
  it("keeps a valid duration", () => {
    expect(sanitizeDurationMs(1200, 1000)).toBe(1200);
  });

  it("falls back when the duration is not finite", () => {
    expect(sanitizeDurationMs(Number.NaN, 1000)).toBe(1000);
  });

  it("clamps negative durations to zero", () => {
    expect(sanitizeDurationMs(-250, 1000)).toBe(0);
  });
});

describe("sanitizePaddingFactor", () => {
  it("keeps a valid padding factor", () => {
    expect(sanitizePaddingFactor(0.8, 0.9)).toBe(0.8);
  });

  it("falls back when the padding factor is not finite", () => {
    expect(sanitizePaddingFactor(Number.NaN, 0.9)).toBe(0.9);
  });

  it("clamps padding to the supported range", () => {
    expect(sanitizePaddingFactor(0, 0.9)).toBe(0.1);
    expect(sanitizePaddingFactor(2, 0.9)).toBe(1);
  });
});
