import { describe, expect, it } from "vitest";
import {
  availabilityQuerySchema,
  checkoutSessionSchema,
  resendMagicLinkSchema,
} from "./schemas";

// ── availabilityQuerySchema ───────────────────────────────────────────────

describe("availabilityQuerySchema", () => {
  // ── Happy path ──────────────────────────────────────────────────────────

  it("accepts a valid daypass query", () => {
    const result = availabilityQuerySchema.safeParse({ type: "daypass" });
    expect(result.success).toBe(true);
  });

  it("accepts a valid membership query with plan_slug", () => {
    const result = availabilityQuerySchema.safeParse({
      type: "membership",
      plan_slug: "flex-desk",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid product query with product_slug and date", () => {
    const result = availabilityQuerySchema.safeParse({
      type: "product",
      product_slug: "week-pass",
      date: "2026-04-15",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a daypass query with optional email", () => {
    const result = availabilityQuerySchema.safeParse({
      type: "daypass",
      email: "maria@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a daypass query with optional date", () => {
    const result = availabilityQuerySchema.safeParse({
      type: "daypass",
      date: "2026-05-20",
    });
    expect(result.success).toBe(true);
  });

  // ── Validation errors ───────────────────────────────────────────────────

  it("rejects an unknown type", () => {
    const result = availabilityQuerySchema.safeParse({ type: "hourly" });
    expect(result.success).toBe(false);
  });

  it("rejects missing type field", () => {
    const result = availabilityQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects membership without plan_slug", () => {
    const result = availabilityQuerySchema.safeParse({ type: "membership" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("plan_slug is required for membership availability checks");
    }
  });

  it("rejects product without product_slug", () => {
    const result = availabilityQuerySchema.safeParse({
      type: "product",
      date: "2026-04-15",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain(
        "product_slug and date are required for product availability checks",
      );
    }
  });

  it("rejects product without date", () => {
    const result = availabilityQuerySchema.safeParse({
      type: "product",
      product_slug: "week-pass",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date format (DD-MM-YYYY)", () => {
    const result = availabilityQuerySchema.safeParse({
      type: "daypass",
      date: "15-04-2026",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date format (MM/DD/YYYY)", () => {
    const result = availabilityQuerySchema.safeParse({
      type: "daypass",
      date: "04/15/2026",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date format (ISO datetime)", () => {
    const result = availabilityQuerySchema.safeParse({
      type: "daypass",
      date: "2026-04-15T10:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = availabilityQuerySchema.safeParse({
      type: "daypass",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("accepts membership with plan_slug and optional fields", () => {
    const result = availabilityQuerySchema.safeParse({
      type: "membership",
      plan_slug: "dedicated-desk",
      email: "tenant@workspace.com",
    });
    expect(result.success).toBe(true);
  });
});

// ── checkoutSessionSchema ─────────────────────────────────────────────────

describe("checkoutSessionSchema", () => {
  // ── Happy path ──────────────────────────────────────────────────────────

  it("accepts a valid daypass checkout", () => {
    const result = checkoutSessionSchema.safeParse({
      type: "daypass",
      email: "maria@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid membership checkout with plan_slug", () => {
    const result = checkoutSessionSchema.safeParse({
      type: "membership",
      email: "carlos@startup.io",
      plan_slug: "flex-desk",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid product checkout with product_slug and start_date", () => {
    const result = checkoutSessionSchema.safeParse({
      type: "product",
      email: "anna@freelance.dev",
      product_slug: "week-pass",
      start_date: "2026-04-20",
    });
    expect(result.success).toBe(true);
  });

  it("accepts checkout with optional name", () => {
    const result = checkoutSessionSchema.safeParse({
      type: "daypass",
      email: "jan@example.com",
      name: "Jan de Vries",
    });
    expect(result.success).toBe(true);
  });

  it("accepts checkout with community_rules_accepted", () => {
    const result = checkoutSessionSchema.safeParse({
      type: "daypass",
      email: "sophie@example.com",
      community_rules_accepted: true,
    });
    expect(result.success).toBe(true);
  });

  // ── Validation errors ───────────────────────────────────────────────────

  it("rejects missing email", () => {
    const result = checkoutSessionSchema.safeParse({ type: "daypass" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = checkoutSessionSchema.safeParse({
      type: "daypass",
      email: "bad-email",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("A valid email is required");
    }
  });

  it("rejects membership without plan_slug", () => {
    const result = checkoutSessionSchema.safeParse({
      type: "membership",
      email: "test@example.com",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("plan_slug is required for membership checkout");
    }
  });

  it("rejects product without product_slug", () => {
    const result = checkoutSessionSchema.safeParse({
      type: "product",
      email: "buyer@example.com",
      start_date: "2026-04-20",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain(
        "product_slug and start_date are required for product checkout",
      );
    }
  });

  it("rejects product without start_date", () => {
    const result = checkoutSessionSchema.safeParse({
      type: "product",
      email: "buyer@example.com",
      product_slug: "week-pass",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid start_date format", () => {
    const result = checkoutSessionSchema.safeParse({
      type: "product",
      email: "buyer@example.com",
      product_slug: "week-pass",
      start_date: "April 20, 2026",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown type", () => {
    const result = checkoutSessionSchema.safeParse({
      type: "credits",
      email: "buyer@example.com",
    });
    expect(result.success).toBe(false);
  });
});

// ── resendMagicLinkSchema ─────────────────────────────────────────────────

describe("resendMagicLinkSchema", () => {
  it("accepts a valid session_id", () => {
    const result = resendMagicLinkSchema.safeParse({
      session_id: "cs_live_abc123def456",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing session_id", () => {
    const result = resendMagicLinkSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty session_id", () => {
    const result = resendMagicLinkSchema.safeParse({ session_id: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("session_id is required");
    }
  });
});
