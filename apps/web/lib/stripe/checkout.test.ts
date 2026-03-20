import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mock dependencies ────────────────────────────────────────────────────

const mockProductsCreate = vi.fn();
const mockPricesCreate = vi.fn();
const mockCheckoutSessionsCreate = vi.fn();

vi.mock("./client", () => ({
  getStripe: () => ({
    products: { create: mockProductsCreate },
    prices: { create: mockPricesCreate },
    checkout: { sessions: { create: mockCheckoutSessionsCreate } },
  }),
}));

const mockUpdate = vi.fn(() => ({ eq: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ update: mockUpdate }),
  }),
}));

import {
  ensureOneTimePriceExists,
  ensureRecurringAddonPriceExists,
  createOneTimeCheckoutSession,
} from "./checkout";

// ── ensureOneTimePriceExists ─────────────────────────────────────────────

describe("ensureOneTimePriceExists", () => {
  const CONNECTED_ACCOUNT = "acct_cowork_tenant_1";
  const SPACE_ID = "space-abc-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing stripe_price_id without creating anything", async () => {
    const product = {
      id: "prod-123",
      name: "Day Pass",
      price_cents: 2500,
      currency: "eur",
      stripe_price_id: "price_existing_123",
      stripe_product_id: "prod_existing_123",
    };

    const result = await ensureOneTimePriceExists(product, CONNECTED_ACCOUNT, SPACE_ID);

    expect(result).toBe("price_existing_123");
    expect(mockProductsCreate).not.toHaveBeenCalled();
    expect(mockPricesCreate).not.toHaveBeenCalled();
  });

  it("creates both Stripe product and price when neither exists", async () => {
    const product = {
      id: "prod-456",
      name: "Day Pass",
      price_cents: 2500,
      currency: "eur",
      stripe_price_id: null,
      stripe_product_id: null,
    };

    mockProductsCreate.mockResolvedValue({ id: "prod_stripe_new" });
    mockPricesCreate.mockResolvedValue({ id: "price_stripe_new" });

    const result = await ensureOneTimePriceExists(product, CONNECTED_ACCOUNT, SPACE_ID);

    expect(result).toBe("price_stripe_new");
    expect(mockProductsCreate).toHaveBeenCalledWith(
      {
        name: "Day Pass",
        metadata: { space_id: SPACE_ID, product_id: "prod-456" },
      },
      { stripeAccount: CONNECTED_ACCOUNT },
    );
    expect(mockPricesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        product: "prod_stripe_new",
        unit_amount: 2500,
        currency: "eur",
      }),
      { stripeAccount: CONNECTED_ACCOUNT },
    );
  });

  it("creates only price when Stripe product already exists", async () => {
    const product = {
      id: "prod-789",
      name: "Day Pass",
      price_cents: 3000,
      currency: "usd",
      stripe_price_id: null,
      stripe_product_id: "prod_already_exists",
    };

    mockPricesCreate.mockResolvedValue({ id: "price_new_for_existing" });

    const result = await ensureOneTimePriceExists(product, CONNECTED_ACCOUNT, SPACE_ID);

    expect(result).toBe("price_new_for_existing");
    expect(mockProductsCreate).not.toHaveBeenCalled();
    expect(mockPricesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ product: "prod_already_exists" }),
      { stripeAccount: CONNECTED_ACCOUNT },
    );
  });

  it("saves the Stripe IDs back to the database", async () => {
    const product = {
      id: "prod-save-test",
      name: "Day Pass",
      price_cents: 2000,
      currency: "eur",
      stripe_price_id: null,
      stripe_product_id: null,
    };

    mockProductsCreate.mockResolvedValue({ id: "prod_saved" });
    mockPricesCreate.mockResolvedValue({ id: "price_saved" });

    await ensureOneTimePriceExists(product, CONNECTED_ACCOUNT, SPACE_ID);

    expect(mockUpdate).toHaveBeenCalledWith({
      stripe_product_id: "prod_saved",
      stripe_price_id: "price_saved",
    });
  });
});

// ── ensureRecurringAddonPriceExists ──────────────────────────────────────

describe("ensureRecurringAddonPriceExists", () => {
  const CONNECTED_ACCOUNT = "acct_cowork_tenant_1";
  const SPACE_ID = "space-abc-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing stripe_price_id without creating anything", async () => {
    const product = {
      id: "addon-123",
      name: "Parking Add-on",
      price_cents: 5000,
      currency: "eur",
      stripe_price_id: "price_addon_existing",
      stripe_product_id: "prod_addon_existing",
    };

    const result = await ensureRecurringAddonPriceExists(product, CONNECTED_ACCOUNT, SPACE_ID);
    expect(result).toBe("price_addon_existing");
    expect(mockPricesCreate).not.toHaveBeenCalled();
  });

  it("creates a recurring price with monthly interval", async () => {
    const product = {
      id: "addon-456",
      name: "Locker Add-on",
      price_cents: 1500,
      currency: "eur",
      stripe_price_id: null,
      stripe_product_id: null,
    };

    mockProductsCreate.mockResolvedValue({ id: "prod_addon_new" });
    mockPricesCreate.mockResolvedValue({ id: "price_addon_new" });

    const result = await ensureRecurringAddonPriceExists(product, CONNECTED_ACCOUNT, SPACE_ID);

    expect(result).toBe("price_addon_new");
    expect(mockPricesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        recurring: { interval: "month" },
        unit_amount: 1500,
        currency: "eur",
      }),
      { stripeAccount: CONNECTED_ACCOUNT },
    );
  });

  it("uses existing stripe_product_id and skips product creation", async () => {
    const product = {
      id: "addon-789",
      name: "Mail Add-on",
      price_cents: 2000,
      currency: "eur",
      stripe_price_id: null,
      stripe_product_id: "prod_addon_preexist",
    };

    mockPricesCreate.mockResolvedValue({ id: "price_addon_reuse" });

    await ensureRecurringAddonPriceExists(product, CONNECTED_ACCOUNT, SPACE_ID);

    expect(mockProductsCreate).not.toHaveBeenCalled();
    expect(mockPricesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ product: "prod_addon_preexist" }),
      { stripeAccount: CONNECTED_ACCOUNT },
    );
  });
});

// ── createOneTimeCheckoutSession ─────────────────────────────────────────

describe("createOneTimeCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseParams = {
    customerId: "cus_cowork_123",
    priceId: "price_daypass_456",
    amountCents: 2500,
    feePercent: 3,
    connectedAccountId: "acct_cowork_tenant_1",
    spaceId: "space-abc-123",
    productId: "prod-daypass-789",
    productCategory: "day_pass",
    userId: "user-def-456",
    successUrl: "https://urban-hive.cowork.io/checkout/success",
    cancelUrl: "https://urban-hive.cowork.io/checkout/cancel",
  };

  it("creates a payment-mode checkout session on the connected account", async () => {
    const mockSession = { id: "cs_test_session_123", url: "https://checkout.stripe.com/..." };
    mockCheckoutSessionsCreate.mockResolvedValue(mockSession);

    const result = await createOneTimeCheckoutSession(baseParams);

    expect(result).toEqual(mockSession);
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        customer: "cus_cowork_123",
        line_items: [{ price: "price_daypass_456", quantity: 1 }],
        success_url: baseParams.successUrl,
        cancel_url: baseParams.cancelUrl,
      }),
      { stripeAccount: "acct_cowork_tenant_1" },
    );
  });

  it("calculates application fee from amount and fee percent", async () => {
    mockCheckoutSessionsCreate.mockResolvedValue({ id: "cs_test" });

    await createOneTimeCheckoutSession(baseParams);

    // 2500 * 3% = 75
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent_data: {
          application_fee_amount: 75,
        },
      }),
      expect.anything(),
    );
  });

  it("includes space, product, and user metadata", async () => {
    mockCheckoutSessionsCreate.mockResolvedValue({ id: "cs_test" });

    await createOneTimeCheckoutSession(baseParams);

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          space_id: "space-abc-123",
          product_id: "prod-daypass-789",
          product_category: "day_pass",
          user_id: "user-def-456",
        }),
      }),
      expect.anything(),
    );
  });

  it("merges extraMetadata into session metadata", async () => {
    mockCheckoutSessionsCreate.mockResolvedValue({ id: "cs_test" });

    await createOneTimeCheckoutSession({
      ...baseParams,
      extraMetadata: { booking_id: "booking-abc-123", resource_id: "room-xyz" },
    });

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          booking_id: "booking-abc-123",
          resource_id: "room-xyz",
          space_id: "space-abc-123",
        }),
      }),
      expect.anything(),
    );
  });

  it("passes zero application fee when feePercent is 0", async () => {
    mockCheckoutSessionsCreate.mockResolvedValue({ id: "cs_test" });

    await createOneTimeCheckoutSession({ ...baseParams, feePercent: 0 });

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent_data: { application_fee_amount: 0 },
      }),
      expect.anything(),
    );
  });
});
