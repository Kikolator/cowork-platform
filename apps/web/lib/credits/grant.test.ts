import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mock Supabase admin client ───────────────────────────────────────────

const mockRpc = vi.fn(() => Promise.resolve({ data: null, error: null }));
const mockSelectChain = {
  select: vi.fn(() => mockSelectChain),
  eq: vi.fn(() => mockSelectChain),
  then: (resolve: (val: unknown) => void) =>
    resolve({ data: null, error: null }),
};

const mockAdminClient = {
  from: vi.fn(() => mockSelectChain),
  rpc: mockRpc,
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockAdminClient,
}));

import { grantMonthlyCredits, expireRenewableCredits } from "./grant";

// ── grantMonthlyCredits ──────────────────────────────────────────────────

describe("grantMonthlyCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseParams = {
    spaceId: "space-abc-123",
    userId: "user-def-456",
    planId: "plan-ghi-789",
    stripeInvoiceId: "in_1234567890",
    validUntil: new Date("2026-04-15T12:00:00.000Z"),
  };

  it("grants credits for each non-unlimited, non-zero config", async () => {
    mockSelectChain.then = (resolve: (val: unknown) => void) =>
      resolve({
        data: [
          { resource_type_id: "rt-desk", monthly_minutes: 480, is_unlimited: false },
          { resource_type_id: "rt-room", monthly_minutes: 120, is_unlimited: false },
        ],
        error: null,
      });

    await grantMonthlyCredits(baseParams);

    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockRpc).toHaveBeenCalledWith("grant_credits", expect.objectContaining({
      p_space_id: "space-abc-123",
      p_user_id: "user-def-456",
      p_resource_type_id: "rt-desk",
      p_amount_minutes: 480,
      p_source: "subscription",
      p_stripe_invoice_id: "in_1234567890",
    }));
    expect(mockRpc).toHaveBeenCalledWith("grant_credits", expect.objectContaining({
      p_resource_type_id: "rt-room",
      p_amount_minutes: 120,
    }));
  });

  it("skips unlimited credit configs", async () => {
    mockSelectChain.then = (resolve: (val: unknown) => void) =>
      resolve({
        data: [
          { resource_type_id: "rt-desk", monthly_minutes: 480, is_unlimited: true },
          { resource_type_id: "rt-room", monthly_minutes: 120, is_unlimited: false },
        ],
        error: null,
      });

    await grantMonthlyCredits(baseParams);

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("grant_credits", expect.objectContaining({
      p_resource_type_id: "rt-room",
    }));
  });

  it("skips configs with zero monthly minutes", async () => {
    mockSelectChain.then = (resolve: (val: unknown) => void) =>
      resolve({
        data: [
          { resource_type_id: "rt-desk", monthly_minutes: 0, is_unlimited: false },
        ],
        error: null,
      });

    await grantMonthlyCredits(baseParams);

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("does nothing when no configs are returned", async () => {
    mockSelectChain.then = (resolve: (val: unknown) => void) =>
      resolve({ data: null, error: null });

    await grantMonthlyCredits(baseParams);

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("passes correct valid_from and valid_until timestamps", async () => {
    mockSelectChain.then = (resolve: (val: unknown) => void) =>
      resolve({
        data: [
          { resource_type_id: "rt-desk", monthly_minutes: 480, is_unlimited: false },
        ],
        error: null,
      });

    await grantMonthlyCredits(baseParams);

    expect(mockRpc).toHaveBeenCalledWith("grant_credits", expect.objectContaining({
      p_valid_from: "2026-03-15T12:00:00.000Z",
      p_valid_until: "2026-04-15T12:00:00.000Z",
    }));
  });
});

// ── expireRenewableCredits ───────────────────────────────────────────────

describe("expireRenewableCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls expire_renewable_credits RPC with correct params", async () => {
    await expireRenewableCredits({
      spaceId: "space-abc-123",
      userId: "user-def-456",
    });

    expect(mockRpc).toHaveBeenCalledWith("expire_renewable_credits", {
      p_space_id: "space-abc-123",
      p_user_id: "user-def-456",
    });
  });

  it("calls the RPC exactly once", async () => {
    await expireRenewableCredits({
      spaceId: "space-abc-123",
      userId: "user-def-456",
    });

    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
});
