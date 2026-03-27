import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mock dependencies ────────────────────────────────────────────────────

const mockProductsCreate = vi.fn();
const mockPricesCreate = vi.fn();
const mockCheckoutSessionsCreate = vi.fn();
const mockCustomersRetrieve = vi.fn();
const mockCustomersCreate = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();
const mockSubscriptionsUpdate = vi.fn();

vi.mock("./client", () => ({
  getStripe: () => ({
    products: { create: mockProductsCreate },
    prices: { create: mockPricesCreate },
    checkout: { sessions: { create: mockCheckoutSessionsCreate } },
    customers: {
      retrieve: mockCustomersRetrieve,
      create: mockCustomersCreate,
    },
    subscriptions: {
      retrieve: mockSubscriptionsRetrieve,
      update: mockSubscriptionsUpdate,
    },
  }),
}));

const mockPlanUpdate = vi.fn(() => ({ eq: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ update: mockPlanUpdate }),
  }),
}));

import {
  ensureStripePriceExists,
  createCheckoutSession,
  findOrCreateCustomer,
  updateSubscriptionPrice,
  cancelSubscriptionAtPeriodEnd,
  resumeSubscriptionCancellation,
} from "./subscriptions";

// ── ensureStripePriceExists ──────────────────────────────────────────────

describe("ensureStripePriceExists", () => {
  const CONNECTED_ACCOUNT = "acct_cowork_tenant_1";
  const SPACE_ID = "space-abc-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing stripe_price_id without creating anything", async () => {
    const plan = {
      id: "plan-basic",
      name: "Basic Hot Desk",
      price_cents: 15000,
      currency: "eur",
      stripe_price_id: "price_existing",
      stripe_product_id: "prod_existing",
    };

    const result = await ensureStripePriceExists(plan, CONNECTED_ACCOUNT, SPACE_ID);

    expect(result).toBe("price_existing");
    expect(mockProductsCreate).not.toHaveBeenCalled();
    expect(mockPricesCreate).not.toHaveBeenCalled();
  });

  it("creates Stripe product and recurring monthly price when neither exists", async () => {
    const plan = {
      id: "plan-pro",
      name: "Pro Dedicated Desk",
      price_cents: 35000,
      currency: "eur",
      stripe_price_id: null,
      stripe_product_id: null,
    };

    mockProductsCreate.mockResolvedValue({ id: "prod_new_pro" });
    mockPricesCreate.mockResolvedValue({ id: "price_new_pro" });

    const result = await ensureStripePriceExists(plan, CONNECTED_ACCOUNT, SPACE_ID);

    expect(result).toBe("price_new_pro");
    expect(mockProductsCreate).toHaveBeenCalledWith(
      {
        name: "Pro Dedicated Desk",
        metadata: { space_id: SPACE_ID, plan_id: "plan-pro" },
      },
      { stripeAccount: CONNECTED_ACCOUNT },
    );
    expect(mockPricesCreate).toHaveBeenCalledWith(
      {
        product: "prod_new_pro",
        unit_amount: 35000,
        currency: "eur",
        recurring: { interval: "month" },
        metadata: { space_id: SPACE_ID, plan_id: "plan-pro" },
      },
      { stripeAccount: CONNECTED_ACCOUNT },
    );
  });

  it("saves stripe IDs back to database", async () => {
    const plan = {
      id: "plan-save",
      name: "Basic",
      price_cents: 10000,
      currency: "eur",
      stripe_price_id: null,
      stripe_product_id: null,
    };

    mockProductsCreate.mockResolvedValue({ id: "prod_db_save" });
    mockPricesCreate.mockResolvedValue({ id: "price_db_save" });

    await ensureStripePriceExists(plan, CONNECTED_ACCOUNT, SPACE_ID);

    expect(mockPlanUpdate).toHaveBeenCalledWith({
      stripe_product_id: "prod_db_save",
      stripe_price_id: "price_db_save",
    });
  });
});

// ── createCheckoutSession ────────────────────────────────────────────────

describe("createCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseParams = {
    customerId: "cus_member_123",
    priceId: "price_plan_456",
    connectedAccountId: "acct_cowork_tenant_1",
    feePercent: 3,
    spaceId: "space-abc-123",
    planId: "plan-pro-789",
    userId: "user-def-456",
    successUrl: "https://urban-hive.cowork.io/subscribe/success",
    cancelUrl: "https://urban-hive.cowork.io/subscribe/cancel",
  };

  it("creates a subscription-mode checkout session on the connected account", async () => {
    const mockSession = { id: "cs_sub_123", url: "https://checkout.stripe.com/sub" };
    mockCheckoutSessionsCreate.mockResolvedValue(mockSession);

    const result = await createCheckoutSession(baseParams);

    expect(result).toEqual(mockSession);
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        customer: "cus_member_123",
        line_items: [{ price: "price_plan_456", quantity: 1 }],
      }),
      { stripeAccount: "acct_cowork_tenant_1" },
    );
  });

  it("sets application_fee_percent on subscription data", async () => {
    mockCheckoutSessionsCreate.mockResolvedValue({ id: "cs_test" });

    await createCheckoutSession(baseParams);

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_data: expect.objectContaining({
          application_fee_percent: 3,
        }),
      }),
      expect.anything(),
    );
  });

  it("includes plan and user metadata on both session and subscription", async () => {
    mockCheckoutSessionsCreate.mockResolvedValue({ id: "cs_test" });

    await createCheckoutSession(baseParams);

    const call = mockCheckoutSessionsCreate.mock.calls[0][0];
    expect(call.metadata).toEqual({
      space_id: "space-abc-123",
      plan_id: "plan-pro-789",
      user_id: "user-def-456",
    });
    expect(call.subscription_data.metadata).toEqual({
      space_id: "space-abc-123",
      plan_id: "plan-pro-789",
      user_id: "user-def-456",
    });
  });
});

// ── findOrCreateCustomer ─────────────────────────────────────────────────

describe("findOrCreateCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const CONNECTED_ACCOUNT = "acct_cowork_tenant_1";

  it("returns existing customer ID when it is valid in Stripe", async () => {
    mockCustomersRetrieve.mockResolvedValue({ id: "cus_existing" });

    const result = await findOrCreateCustomer({
      email: "maria@urbanhive.co",
      name: "Maria Garcia",
      existingCustomerId: "cus_existing",
      connectedAccountId: CONNECTED_ACCOUNT,
      spaceId: "space-abc-123",
      userId: "user-maria",
    });

    expect(result).toBe("cus_existing");
    expect(mockCustomersCreate).not.toHaveBeenCalled();
  });

  it("creates a new customer when existing one was deleted", async () => {
    mockCustomersRetrieve.mockRejectedValue(new Error("No such customer"));
    mockCustomersCreate.mockResolvedValue({ id: "cus_recreated" });

    const result = await findOrCreateCustomer({
      email: "maria@urbanhive.co",
      name: "Maria Garcia",
      existingCustomerId: "cus_deleted",
      connectedAccountId: CONNECTED_ACCOUNT,
      spaceId: "space-abc-123",
      userId: "user-maria",
    });

    expect(result).toBe("cus_recreated");
    expect(mockCustomersCreate).toHaveBeenCalledWith(
      {
        email: "maria@urbanhive.co",
        name: "Maria Garcia",
        metadata: { space_id: "space-abc-123", user_id: "user-maria" },
      },
      { stripeAccount: CONNECTED_ACCOUNT },
    );
  });

  it("creates a new customer when no existing customer ID is provided", async () => {
    mockCustomersCreate.mockResolvedValue({ id: "cus_brand_new" });

    const result = await findOrCreateCustomer({
      email: "james@workshop.io",
      name: "James Chen",
      existingCustomerId: null,
      connectedAccountId: CONNECTED_ACCOUNT,
      spaceId: "space-abc-123",
      userId: "user-james",
    });

    expect(result).toBe("cus_brand_new");
    expect(mockCustomersRetrieve).not.toHaveBeenCalled();
  });

  it("passes undefined name when name is null", async () => {
    mockCustomersCreate.mockResolvedValue({ id: "cus_no_name" });

    await findOrCreateCustomer({
      email: "anon@example.com",
      name: null,
      existingCustomerId: null,
      connectedAccountId: CONNECTED_ACCOUNT,
      spaceId: "space-abc-123",
      userId: "user-anon",
    });

    expect(mockCustomersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: undefined }),
      expect.anything(),
    );
  });
});

// ── updateSubscriptionPrice ──────────────────────────────────────────────

describe("updateSubscriptionPrice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const CONNECTED_ACCOUNT = "acct_cowork_tenant_1";

  it("updates the first subscription item to the new price", async () => {
    mockSubscriptionsRetrieve.mockResolvedValue({
      items: { data: [{ id: "si_item_123" }] },
    });
    mockSubscriptionsUpdate.mockResolvedValue({ id: "sub_updated" });

    const result = await updateSubscriptionPrice({
      subscriptionId: "sub_upgrade_123",
      newPriceId: "price_pro_new",
      newPlanId: "plan-pro-upgraded",
      connectedAccountId: CONNECTED_ACCOUNT,
    });

    expect(result).toEqual({ id: "sub_updated" });
    expect(mockSubscriptionsUpdate).toHaveBeenCalledWith(
      "sub_upgrade_123",
      {
        items: [{ id: "si_item_123", price: "price_pro_new" }],
        proration_behavior: "create_prorations",
        metadata: { plan_id: "plan-pro-upgraded" },
      },
      { stripeAccount: CONNECTED_ACCOUNT },
    );
  });

  it("throws when subscription has no items", async () => {
    mockSubscriptionsRetrieve.mockResolvedValue({
      items: { data: [] },
    });

    await expect(
      updateSubscriptionPrice({
        subscriptionId: "sub_empty",
        newPriceId: "price_new",
        newPlanId: "plan-new",
        connectedAccountId: CONNECTED_ACCOUNT,
      }),
    ).rejects.toThrow("Subscription has no items");
  });

  it("retrieves the subscription from the connected account", async () => {
    mockSubscriptionsRetrieve.mockResolvedValue({
      items: { data: [{ id: "si_item" }] },
    });
    mockSubscriptionsUpdate.mockResolvedValue({ id: "sub_ok" });

    await updateSubscriptionPrice({
      subscriptionId: "sub_check",
      newPriceId: "price_check",
      newPlanId: "plan-check",
      connectedAccountId: CONNECTED_ACCOUNT,
    });

    expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith(
      "sub_check",
      { stripeAccount: CONNECTED_ACCOUNT },
    );
  });
});

// ── cancelSubscriptionAtPeriodEnd ────────────────────────────────────────

describe("cancelSubscriptionAtPeriodEnd", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets cancel_at_period_end to true on the connected account", async () => {
    mockSubscriptionsUpdate.mockResolvedValue({
      id: "sub_cancelling",
      cancel_at_period_end: true,
    });

    const result = await cancelSubscriptionAtPeriodEnd("sub_cancelling", "acct_tenant_1");

    expect(result.cancel_at_period_end).toBe(true);
    expect(mockSubscriptionsUpdate).toHaveBeenCalledWith(
      "sub_cancelling",
      { cancel_at_period_end: true },
      { stripeAccount: "acct_tenant_1" },
    );
  });
});

// ── resumeSubscriptionCancellation ───────────────────────────────────────

describe("resumeSubscriptionCancellation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets cancel_at_period_end to false on the connected account", async () => {
    mockSubscriptionsUpdate.mockResolvedValue({
      id: "sub_resumed",
      cancel_at_period_end: false,
    });

    const result = await resumeSubscriptionCancellation("sub_resumed", "acct_tenant_1");

    expect(result.cancel_at_period_end).toBe(false);
    expect(mockSubscriptionsUpdate).toHaveBeenCalledWith(
      "sub_resumed",
      { cancel_at_period_end: false },
      { stripeAccount: "acct_tenant_1" },
    );
  });
});
