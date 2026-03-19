import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

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
});
