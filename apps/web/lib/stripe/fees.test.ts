import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { calculateApplicationFee } from "./fees";

// ── calculateApplicationFee ───────────────────────────────────────────────

describe("calculateApplicationFee", () => {
  it("calculates 3% of 1000 cents (30)", () => {
    expect(calculateApplicationFee(1000)).toBe(30);
  });

  it("calculates 3% of 10000 cents (300)", () => {
    expect(calculateApplicationFee(10000)).toBe(300);
  });

  it("rounds correctly for non-integer results (333 cents -> 10)", () => {
    // 333 * 0.03 = 9.99 → rounds to 10
    expect(calculateApplicationFee(333)).toBe(10);
  });

  it("returns 0 for zero amount", () => {
    expect(calculateApplicationFee(0)).toBe(0);
  });

  it("returns 0 for very small amounts (1 cent)", () => {
    // 1 * 0.03 = 0.03 → rounds to 0
    expect(calculateApplicationFee(1)).toBe(0);
  });

  it("rounds down when fractional part is below 0.5", () => {
    // 100 * 0.03 = 3.0 → exactly 3
    expect(calculateApplicationFee(100)).toBe(3);
  });

  it("handles larger amounts correctly", () => {
    // 50000 * 0.03 = 1500
    expect(calculateApplicationFee(50000)).toBe(1500);
  });
});
