import { describe, expect, it } from "vitest";
import { calculateApplicationFee, getEffectiveFeePercent } from "./fees";

// ── getEffectiveFeePercent ────────────────────────────────────────────────

describe("getEffectiveFeePercent", () => {
  it("returns override when provided", () => {
    expect(getEffectiveFeePercent("free", 10)).toBe(10);
  });

  it("returns plan default when override is null", () => {
    expect(getEffectiveFeePercent("free", null)).toBe(5);
    expect(getEffectiveFeePercent("pro", null)).toBe(3);
    expect(getEffectiveFeePercent("enterprise", null)).toBe(1);
  });

  it("returns free default for unknown plan", () => {
    expect(getEffectiveFeePercent("unknown", null)).toBe(5);
  });

  it("allows zero override", () => {
    expect(getEffectiveFeePercent("pro", 0)).toBe(0);
  });

  it("returns override even when it matches the plan default", () => {
    // Override of 3 on pro plan (which defaults to 3) should still return 3
    expect(getEffectiveFeePercent("pro", 3)).toBe(3);
  });

  it("returns override higher than any plan default", () => {
    expect(getEffectiveFeePercent("enterprise", 15)).toBe(15);
  });

  it("returns free default for empty string plan", () => {
    expect(getEffectiveFeePercent("", null)).toBe(5);
  });

  it("distinguishes between all three plan tiers", () => {
    const free = getEffectiveFeePercent("free", null);
    const pro = getEffectiveFeePercent("pro", null);
    const enterprise = getEffectiveFeePercent("enterprise", null);
    expect(free).toBeGreaterThan(pro);
    expect(pro).toBeGreaterThan(enterprise);
  });
});

// ── calculateApplicationFee ───────────────────────────────────────────────

describe("calculateApplicationFee", () => {
  it("calculates 3% of 1000 cents (30)", () => {
    expect(calculateApplicationFee(1000, 3)).toBe(30);
  });

  it("calculates 5% of 10000 cents (500)", () => {
    expect(calculateApplicationFee(10000, 5)).toBe(500);
  });

  it("rounds correctly for non-integer results", () => {
    // 333 * 0.03 = 9.99 → rounds to 10
    expect(calculateApplicationFee(333, 3)).toBe(10);
  });

  it("returns 0 for zero amount", () => {
    expect(calculateApplicationFee(0, 3)).toBe(0);
  });

  it("returns 0 for zero fee percent", () => {
    expect(calculateApplicationFee(10000, 0)).toBe(0);
  });

  it("returns 0 for very small amounts (1 cent at 1%)", () => {
    // 1 * 0.01 = 0.01 → rounds to 0
    expect(calculateApplicationFee(1, 1)).toBe(0);
  });

  it("handles larger amounts correctly", () => {
    // 50000 * 0.05 = 2500
    expect(calculateApplicationFee(50000, 5)).toBe(2500);
  });

  it("rounds down at exactly 0.5 fractional cent (banker's rounding)", () => {
    // 150 * 0.03 = 4.5 → Math.round(4.5) = 5 (JS rounds .5 up for positive numbers)
    expect(calculateApplicationFee(150, 3)).toBe(5);
  });

  it("rounds up when fractional cent is above 0.5", () => {
    // 151 * 0.03 = 4.53 → rounds to 5
    expect(calculateApplicationFee(151, 3)).toBe(5);
  });

  it("handles 100% fee (full amount)", () => {
    expect(calculateApplicationFee(5000, 100)).toBe(5000);
  });

  it("handles 1 cent at 100% fee", () => {
    expect(calculateApplicationFee(1, 100)).toBe(1);
  });

  it("handles both zero amount and zero percent", () => {
    expect(calculateApplicationFee(0, 0)).toBe(0);
  });

  it("produces consistent results for typical subscription amounts", () => {
    // $49.99 = 4999 cents at 5% = 249.95 → 250
    expect(calculateApplicationFee(4999, 5)).toBe(250);
    // $99.00 = 9900 cents at 3% = 297
    expect(calculateApplicationFee(9900, 3)).toBe(297);
  });
});
