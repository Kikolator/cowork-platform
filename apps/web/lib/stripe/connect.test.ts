import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mock dependencies ────────────────────────────────────────────────────

const mockAccountsRetrieve = vi.fn();
const mockAccountsCreate = vi.fn();
const mockAccountLinksCreate = vi.fn();

vi.mock("./client", () => ({
  getStripe: () => ({
    accounts: {
      retrieve: mockAccountsRetrieve,
      create: mockAccountsCreate,
    },
    accountLinks: { create: mockAccountLinksCreate },
  }),
}));

const mockTenantResult = { data: null as unknown, error: null as unknown };
const mockSelectChain: Record<string, unknown> = {};
for (const m of ["select", "eq"]) {
  mockSelectChain[m] = vi.fn(() => mockSelectChain);
}
mockSelectChain.single = vi.fn(() => Promise.resolve(mockTenantResult));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => mockSelectChain,
  }),
}));

import {
  getOrCreateConnectAccount,
  createAccountLink,
  isAccountOnboarded,
  verifyStripeReady,
} from "./connect";

// ── getOrCreateConnectAccount ────────────────────────────────────────────

describe("getOrCreateConnectAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing account ID when it is valid in Stripe", async () => {
    mockAccountsRetrieve.mockResolvedValue({ id: "acct_existing_123" });

    const result = await getOrCreateConnectAccount(
      "tenant-abc",
      "acct_existing_123",
      "Urban Hive",
      "admin@urbanhive.co",
    );

    expect(result).toBe("acct_existing_123");
    expect(mockAccountsCreate).not.toHaveBeenCalled();
  });

  it("creates a new account when existing account was deleted in Stripe", async () => {
    mockAccountsRetrieve.mockRejectedValue(new Error("No such account: acct_deleted"));
    mockAccountsCreate.mockResolvedValue({ id: "acct_new_456" });

    const result = await getOrCreateConnectAccount(
      "tenant-abc",
      "acct_deleted",
      "Urban Hive",
      "admin@urbanhive.co",
    );

    expect(result).toBe("acct_new_456");
    expect(mockAccountsCreate).toHaveBeenCalledWith({
      type: "standard",
      business_profile: { name: "Urban Hive" },
      email: "admin@urbanhive.co",
      metadata: { tenant_id: "tenant-abc" },
    });
  });

  it("creates a new account when no existing account ID is provided", async () => {
    mockAccountsCreate.mockResolvedValue({ id: "acct_brand_new" });

    const result = await getOrCreateConnectAccount(
      "tenant-xyz",
      null,
      "The Workshop",
      "owner@workshop.io",
    );

    expect(result).toBe("acct_brand_new");
    expect(mockAccountsRetrieve).not.toHaveBeenCalled();
    expect(mockAccountsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "standard",
        email: "owner@workshop.io",
        metadata: { tenant_id: "tenant-xyz" },
      }),
    );
  });
});

// ── createAccountLink ────────────────────────────────────────────────────

describe("createAccountLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an account onboarding link and returns the URL", async () => {
    mockAccountLinksCreate.mockResolvedValue({
      url: "https://connect.stripe.com/setup/s/abc123",
    });

    const result = await createAccountLink(
      "acct_tenant_1",
      "https://urbanhive.cowork.io/settings/stripe/return",
      "https://urbanhive.cowork.io/settings/stripe/refresh",
    );

    expect(result).toBe("https://connect.stripe.com/setup/s/abc123");
    expect(mockAccountLinksCreate).toHaveBeenCalledWith({
      account: "acct_tenant_1",
      return_url: "https://urbanhive.cowork.io/settings/stripe/return",
      refresh_url: "https://urbanhive.cowork.io/settings/stripe/refresh",
      type: "account_onboarding",
    });
  });
});

// ── isAccountOnboarded ───────────────────────────────────────────────────

describe("isAccountOnboarded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns complete: true when charges and payouts are enabled", async () => {
    mockAccountsRetrieve.mockResolvedValue({
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
    });

    const result = await isAccountOnboarded("acct_full_onboarded");

    expect(result).toEqual({
      complete: true,
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
    });
  });

  it("returns complete: false when charges are not enabled", async () => {
    mockAccountsRetrieve.mockResolvedValue({
      charges_enabled: false,
      payouts_enabled: true,
      details_submitted: true,
    });

    const result = await isAccountOnboarded("acct_partial");

    expect(result.complete).toBe(false);
    expect(result.chargesEnabled).toBe(false);
  });

  it("returns complete: false when payouts are not enabled", async () => {
    mockAccountsRetrieve.mockResolvedValue({
      charges_enabled: true,
      payouts_enabled: false,
      details_submitted: false,
    });

    const result = await isAccountOnboarded("acct_no_payouts");

    expect(result.complete).toBe(false);
    expect(result.payoutsEnabled).toBe(false);
    expect(result.detailsSubmitted).toBe(false);
  });

  it("handles undefined boolean fields from Stripe", async () => {
    mockAccountsRetrieve.mockResolvedValue({
      charges_enabled: undefined,
      payouts_enabled: undefined,
      details_submitted: undefined,
    });

    const result = await isAccountOnboarded("acct_empty");

    // charges_enabled && payouts_enabled with undefined values is falsy
    expect(result.complete).toBeFalsy();
    expect(result.chargesEnabled).toBe(false);
    expect(result.payoutsEnabled).toBe(false);
    expect(result.detailsSubmitted).toBe(false);
  });
});

// ── verifyStripeReady ────────────────────────────────────────────────────

describe("verifyStripeReady", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns stripe info when account is fully set up", async () => {
    mockTenantResult.data = {
      stripe_account_id: "acct_ready_123",
      stripe_onboarding_complete: true,
      platform_plan: "pro",
      platform_fee_percent: 2.5,
    };
    mockTenantResult.error = null;

    const result = await verifyStripeReady("tenant-ready");

    expect(result).toEqual({
      stripeAccountId: "acct_ready_123",
      platformPlan: "pro",
      platformFeePercent: 2.5,
    });
  });

  it("throws when Stripe is not connected", async () => {
    mockTenantResult.data = {
      stripe_account_id: null,
      stripe_onboarding_complete: false,
      platform_plan: "free",
      platform_fee_percent: null,
    };
    mockTenantResult.error = null;

    await expect(verifyStripeReady("tenant-no-stripe")).rejects.toThrow(
      "Stripe not connected",
    );
  });

  it("throws when onboarding is incomplete", async () => {
    mockTenantResult.data = {
      stripe_account_id: "acct_incomplete",
      stripe_onboarding_complete: false,
      platform_plan: "free",
      platform_fee_percent: null,
    };
    mockTenantResult.error = null;

    await expect(verifyStripeReady("tenant-incomplete")).rejects.toThrow(
      "Stripe setup incomplete",
    );
  });

  it("returns null for platformFeePercent when tenant has no override", async () => {
    mockTenantResult.data = {
      stripe_account_id: "acct_no_override",
      stripe_onboarding_complete: true,
      platform_plan: "free",
      platform_fee_percent: null,
    };
    mockTenantResult.error = null;

    const result = await verifyStripeReady("tenant-default-fee");

    expect(result.platformFeePercent).toBeNull();
  });

  it("throws when tenant data is not found", async () => {
    mockTenantResult.data = null;
    mockTenantResult.error = { code: "PGRST116" };

    await expect(verifyStripeReady("tenant-missing")).rejects.toThrow(
      "Stripe not connected",
    );
  });
});
