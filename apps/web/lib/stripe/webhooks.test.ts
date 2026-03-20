import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type Stripe from "stripe";

// ── Configurable mock responses (set per test) ─────────────────────────

let memberSelectResult: unknown = null;
let planSelectResult: unknown = null;
let passSelectResult: unknown = null;
let productSelectResult: unknown = null;

// ── Call tracking ───────────────────────────────────────────────────────

const updateCalls: Array<{ table: string; data: unknown }> = [];
const insertCalls: Array<{ table: string; data: unknown }> = [];
const upsertCalls: Array<{ table: string; data: unknown; opts: unknown }> = [];
const rpcCalls: Array<{ fn: string; args: unknown }> = [];

const mockRpc = vi.fn((fn: string, args: unknown) => {
  rpcCalls.push({ fn, args });
  return Promise.resolve({ data: null, error: null });
});

function createQueryChain(table: string) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.update = vi.fn((data: unknown) => {
    updateCalls.push({ table, data });
    return chain;
  });
  chain.insert = vi.fn((data: unknown) => {
    insertCalls.push({ table, data });
    return Promise.resolve({ error: null });
  });
  chain.upsert = vi.fn((data: unknown, opts: unknown) => {
    upsertCalls.push({ table, data, opts });
    return Promise.resolve({ error: null });
  });
  chain.maybeSingle = vi.fn(() => {
    const responses: Record<string, unknown> = {
      members: memberSelectResult,
      plans: planSelectResult,
    };
    return Promise.resolve({ data: responses[table] ?? null, error: null });
  });
  chain.single = vi.fn(() => {
    const responses: Record<string, unknown> = {
      passes: passSelectResult,
      products: productSelectResult,
    };
    return Promise.resolve({ data: responses[table] ?? null, error: null });
  });
  return chain;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: vi.fn((table: string) => createQueryChain(table)),
    rpc: mockRpc,
  }),
}));

// ── Mock credits/grant ──────────────────────────────────────────────────

const mockGrantMonthlyCredits = vi.fn();
const mockExpireRenewableCredits = vi.fn();

vi.mock("@/lib/credits/grant", () => ({
  grantMonthlyCredits: (...args: unknown[]) => mockGrantMonthlyCredits(...args),
  expireRenewableCredits: (...args: unknown[]) =>
    mockExpireRenewableCredits(...args),
}));

import { routeWebhookEvent } from "./webhooks";

// ── Stripe event factory helpers ────────────────────────────────────────

function makeEvent(
  type: string,
  object: Record<string, unknown>,
): Stripe.Event {
  return {
    type,
    data: { object },
  } as unknown as Stripe.Event;
}

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: "in_test_123",
    billing_reason: "subscription_cycle",
    parent: {
      type: "subscription_details",
      subscription_details: {
        subscription: "sub_test_123",
      },
    },
    lines: {
      data: [{ period: { end: 1745000000 } }],
    },
    ...overrides,
  };
}

// ── Setup / teardown ────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));

  memberSelectResult = null;
  planSelectResult = null;
  passSelectResult = null;
  productSelectResult = null;
  updateCalls.length = 0;
  insertCalls.length = 0;
  upsertCalls.length = 0;
  rpcCalls.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

// =========================================================================
// routeWebhookEvent — routing
// =========================================================================

describe("routeWebhookEvent routing", () => {
  it("handles unknown event types without error", async () => {
    const event = makeEvent("unknown.event", {});
    await expect(
      routeWebhookEvent(event, "space-1", "tenant-1"),
    ).resolves.toBeUndefined();
  });
});

// =========================================================================
// account.updated
// =========================================================================

describe("account.updated", () => {
  it("sets onboarding complete when both charges and payouts enabled", async () => {
    const event = makeEvent("account.updated", {
      id: "acct_123",
      charges_enabled: true,
      payouts_enabled: true,
    });

    await routeWebhookEvent(event, null, "tenant-1");

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]).toEqual({
      table: "tenants",
      data: { stripe_onboarding_complete: true },
    });
  });

  it("sets onboarding incomplete when charges disabled", async () => {
    const event = makeEvent("account.updated", {
      id: "acct_123",
      charges_enabled: false,
      payouts_enabled: true,
    });

    await routeWebhookEvent(event, null, "tenant-1");

    expect(updateCalls[0]!.data).toEqual({
      stripe_onboarding_complete: false,
    });
  });

  it("sets onboarding incomplete when payouts disabled", async () => {
    const event = makeEvent("account.updated", {
      id: "acct_123",
      charges_enabled: true,
      payouts_enabled: false,
    });

    await routeWebhookEvent(event, null, "tenant-1");

    expect(updateCalls[0]!.data).toEqual({
      stripe_onboarding_complete: false,
    });
  });

  it("handles missing flags as false", async () => {
    const event = makeEvent("account.updated", { id: "acct_123" });

    await routeWebhookEvent(event, null, "tenant-1");

    expect(updateCalls[0]!.data).toEqual({
      stripe_onboarding_complete: false,
    });
  });
});

// =========================================================================
// checkout.session.completed — subscription mode
// =========================================================================

describe("checkout.session.completed (subscription)", () => {
  function makeSubscriptionCheckoutEvent(
    metadata: Record<string, string> = {},
  ) {
    return makeEvent("checkout.session.completed", {
      mode: "subscription",
      customer: "cus_test_123",
      subscription: "sub_test_123",
      metadata: {
        user_id: "user-abc",
        plan_id: "plan-xyz",
        space_id: "space-1",
        ...metadata,
      },
    });
  }

  it("creates new member when no existing member found", async () => {
    memberSelectResult = null;

    await routeWebhookEvent(
      makeSubscriptionCheckoutEvent(),
      "space-1",
      "tenant-1",
    );

    // Should insert new member
    const memberInsert = insertCalls.find((c) => c.table === "members");
    expect(memberInsert).toBeDefined();
    expect(memberInsert!.data).toEqual(
      expect.objectContaining({
        space_id: "space-1",
        user_id: "user-abc",
        plan_id: "plan-xyz",
        stripe_customer_id: "cus_test_123",
        stripe_subscription_id: "sub_test_123",
        status: "active",
      }),
    );

    // Should upsert space_users
    const spaceUsersUpsert = upsertCalls.find(
      (c) => c.table === "space_users",
    );
    expect(spaceUsersUpsert).toBeDefined();
    expect(spaceUsersUpsert!.data).toEqual(
      expect.objectContaining({
        user_id: "user-abc",
        space_id: "space-1",
        role: "member",
      }),
    );
  });

  it("reactivates existing churned member", async () => {
    memberSelectResult = { id: "member-existing", status: "churned" };

    await routeWebhookEvent(
      makeSubscriptionCheckoutEvent(),
      "space-1",
      "tenant-1",
    );

    // Should update existing member, not insert
    const memberUpdate = updateCalls.find((c) => c.table === "members");
    expect(memberUpdate).toBeDefined();
    expect(memberUpdate!.data).toEqual(
      expect.objectContaining({
        plan_id: "plan-xyz",
        stripe_customer_id: "cus_test_123",
        stripe_subscription_id: "sub_test_123",
        status: "active",
        cancelled_at: null,
        cancel_requested_at: null,
      }),
    );

    expect(insertCalls.find((c) => c.table === "members")).toBeUndefined();
  });

  it("returns early when required metadata is missing", async () => {
    const event = makeEvent("checkout.session.completed", {
      mode: "subscription",
      customer: "cus_test_123",
      subscription: "sub_test_123",
      metadata: { user_id: "user-abc" }, // Missing plan_id
    });

    await routeWebhookEvent(event, "space-1", "tenant-1");

    expect(insertCalls.find((c) => c.table === "members")).toBeUndefined();
    expect(updateCalls.find((c) => c.table === "members")).toBeUndefined();
  });

  it("returns early on space_id mismatch", async () => {
    const event = makeSubscriptionCheckoutEvent({ space_id: "space-other" });

    await routeWebhookEvent(event, "space-1", "tenant-1");

    expect(insertCalls.find((c) => c.table === "members")).toBeUndefined();
    expect(updateCalls.find((c) => c.table === "members")).toBeUndefined();
  });
});

// =========================================================================
// checkout.session.completed — pass
// =========================================================================

describe("checkout.session.completed (pass)", () => {
  function makePassCheckoutEvent() {
    return makeEvent("checkout.session.completed", {
      id: "cs_test_123",
      mode: "payment",
      metadata: {
        product_category: "pass",
        pass_id: "pass-abc",
        user_id: "user-abc",
      },
    });
  }

  it("activates pass and auto-assigns desk", async () => {
    passSelectResult = {
      start_date: "2026-03-20",
      end_date: "2026-03-20",
    };
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "auto_assign_desk")
        return Promise.resolve({ data: "desk-uuid-123", error: null });
      return Promise.resolve({ data: null, error: null });
    });

    await routeWebhookEvent(makePassCheckoutEvent(), "space-1", "tenant-1");

    // Should call activate_pass RPC
    expect(mockRpc).toHaveBeenCalledWith(
      "activate_pass",
      expect.objectContaining({
        p_space_id: "space-1",
        p_user_id: "user-abc",
        p_stripe_session_id: "cs_test_123",
      }),
    );

    // Should call auto_assign_desk RPC
    expect(mockRpc).toHaveBeenCalledWith(
      "auto_assign_desk",
      expect.objectContaining({
        p_space_id: "space-1",
        p_start_date: "2026-03-20",
        p_end_date: "2026-03-20",
      }),
    );

    // Should update pass with assigned desk
    const passUpdate = updateCalls.find((c) => c.table === "passes");
    expect(passUpdate).toBeDefined();
    expect(passUpdate!.data).toEqual({ assigned_desk_id: "desk-uuid-123" });
  });

  it("handles no available desk gracefully", async () => {
    passSelectResult = {
      start_date: "2026-03-20",
      end_date: "2026-03-20",
    };
    mockRpc.mockImplementation(() =>
      Promise.resolve({ data: null, error: null }),
    );

    await routeWebhookEvent(makePassCheckoutEvent(), "space-1", "tenant-1");

    // Should NOT update pass with desk assignment
    expect(updateCalls.find((c) => c.table === "passes")).toBeUndefined();
  });

  it("returns early when activate_pass fails", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "activate_pass")
        return Promise.resolve({
          data: null,
          error: { message: "already activated" },
        });
      return Promise.resolve({ data: null, error: null });
    });

    await routeWebhookEvent(makePassCheckoutEvent(), "space-1", "tenant-1");

    // Should NOT call auto_assign_desk after failure
    expect(mockRpc).not.toHaveBeenCalledWith(
      "auto_assign_desk",
      expect.anything(),
    );
  });

  it("returns early when metadata is missing", async () => {
    const event = makeEvent("checkout.session.completed", {
      id: "cs_test_123",
      mode: "payment",
      metadata: { product_category: "pass" }, // Missing pass_id and user_id
    });

    await routeWebhookEvent(event, "space-1", "tenant-1");

    expect(mockRpc).not.toHaveBeenCalledWith(
      "activate_pass",
      expect.anything(),
    );
  });
});

// =========================================================================
// checkout.session.completed — hour_bundle
// =========================================================================

describe("checkout.session.completed (hour_bundle)", () => {
  function makeHourBundleEvent() {
    return makeEvent("checkout.session.completed", {
      id: "cs_bundle_123",
      mode: "payment",
      metadata: {
        product_category: "hour_bundle",
        product_id: "prod-abc",
        user_id: "user-abc",
      },
    });
  }

  it("grants credits from product credit_grant_config", async () => {
    productSelectResult = {
      credit_grant_config: {
        resource_type_id: "rt-meeting-room",
        minutes: 600,
      },
    };

    await routeWebhookEvent(makeHourBundleEvent(), "space-1", "tenant-1");

    expect(mockRpc).toHaveBeenCalledWith(
      "grant_credits",
      expect.objectContaining({
        p_space_id: "space-1",
        p_user_id: "user-abc",
        p_resource_type_id: "rt-meeting-room",
        p_amount_minutes: 600,
        p_source: "purchase",
        p_stripe_line_item_id: "cs_bundle_123",
      }),
    );
  });

  it("returns early when product has no credit_grant_config", async () => {
    productSelectResult = { credit_grant_config: null };

    await routeWebhookEvent(makeHourBundleEvent(), "space-1", "tenant-1");

    expect(mockRpc).not.toHaveBeenCalledWith(
      "grant_credits",
      expect.anything(),
    );
  });

  it("returns early when config is missing required fields", async () => {
    productSelectResult = {
      credit_grant_config: { resource_type_id: "rt-room" }, // Missing minutes
    };

    await routeWebhookEvent(makeHourBundleEvent(), "space-1", "tenant-1");

    expect(mockRpc).not.toHaveBeenCalledWith(
      "grant_credits",
      expect.anything(),
    );
  });

  it("returns early when metadata is missing", async () => {
    const event = makeEvent("checkout.session.completed", {
      id: "cs_bundle_123",
      mode: "payment",
      metadata: { product_category: "hour_bundle" }, // Missing product_id and user_id
    });

    await routeWebhookEvent(event, "space-1", "tenant-1");

    expect(mockRpc).not.toHaveBeenCalledWith(
      "grant_credits",
      expect.anything(),
    );
  });
});

// =========================================================================
// checkout.session.completed — deposit / event (no-op categories)
// =========================================================================

describe("checkout.session.completed (deposit/event)", () => {
  it("does nothing for deposit category", async () => {
    const event = makeEvent("checkout.session.completed", {
      mode: "payment",
      metadata: { product_category: "deposit" },
    });

    await routeWebhookEvent(event, "space-1", "tenant-1");

    expect(insertCalls).toHaveLength(0);
    expect(updateCalls).toHaveLength(0);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("does nothing for event category", async () => {
    const event = makeEvent("checkout.session.completed", {
      mode: "payment",
      metadata: { product_category: "event" },
    });

    await routeWebhookEvent(event, "space-1", "tenant-1");

    expect(insertCalls).toHaveLength(0);
    expect(updateCalls).toHaveLength(0);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

// =========================================================================
// invoice.paid
// =========================================================================

describe("invoice.paid", () => {
  it("reactivates past_due member and grants credits", async () => {
    memberSelectResult = {
      id: "member-1",
      user_id: "user-abc",
      plan_id: "plan-xyz",
      status: "past_due",
    };

    const event = makeEvent("invoice.paid", makeInvoice());

    await routeWebhookEvent(event, "space-1", "tenant-1");

    // Should reactivate member
    const memberUpdate = updateCalls.find((c) => c.table === "members");
    expect(memberUpdate).toBeDefined();
    expect(memberUpdate!.data).toEqual(
      expect.objectContaining({ status: "active" }),
    );

    // Should expire old credits (subscription_cycle billing reason)
    expect(mockExpireRenewableCredits).toHaveBeenCalledWith({
      spaceId: "space-1",
      userId: "user-abc",
    });

    // Should grant new credits
    expect(mockGrantMonthlyCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        spaceId: "space-1",
        userId: "user-abc",
        planId: "plan-xyz",
        stripeInvoiceId: "in_test_123",
      }),
    );
  });

  it("does not reactivate active member but still grants credits", async () => {
    memberSelectResult = {
      id: "member-1",
      user_id: "user-abc",
      plan_id: "plan-xyz",
      status: "active",
    };

    const event = makeEvent("invoice.paid", makeInvoice());

    await routeWebhookEvent(event, "space-1", "tenant-1");

    // Should NOT update member status (already active)
    expect(updateCalls.find((c) => c.table === "members")).toBeUndefined();

    // Should still grant credits
    expect(mockGrantMonthlyCredits).toHaveBeenCalled();
  });

  it("does not expire credits for initial subscription", async () => {
    memberSelectResult = {
      id: "member-1",
      user_id: "user-abc",
      plan_id: "plan-xyz",
      status: "active",
    };

    const event = makeEvent(
      "invoice.paid",
      makeInvoice({ billing_reason: "subscription_create" }),
    );

    await routeWebhookEvent(event, "space-1", "tenant-1");

    // Should NOT expire credits for initial subscription
    expect(mockExpireRenewableCredits).not.toHaveBeenCalled();

    // Should still grant credits
    expect(mockGrantMonthlyCredits).toHaveBeenCalled();
  });

  it("uses period end from invoice lines for validUntil", async () => {
    memberSelectResult = {
      id: "member-1",
      user_id: "user-abc",
      plan_id: "plan-xyz",
      status: "active",
    };

    const periodEnd = 1745000000; // Specific timestamp
    const event = makeEvent(
      "invoice.paid",
      makeInvoice({
        lines: { data: [{ period: { end: periodEnd } }] },
      }),
    );

    await routeWebhookEvent(event, "space-1", "tenant-1");

    expect(mockGrantMonthlyCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        validUntil: new Date(periodEnd * 1000),
      }),
    );
  });

  it("falls back to 30 days when no period end", async () => {
    memberSelectResult = {
      id: "member-1",
      user_id: "user-abc",
      plan_id: "plan-xyz",
      status: "active",
    };

    const event = makeEvent(
      "invoice.paid",
      makeInvoice({ lines: { data: [] } }),
    );

    await routeWebhookEvent(event, "space-1", "tenant-1");

    const expected = new Date(
      new Date("2026-03-15T12:00:00.000Z").getTime() + 30 * 24 * 60 * 60 * 1000,
    );
    expect(mockGrantMonthlyCredits).toHaveBeenCalledWith(
      expect.objectContaining({ validUntil: expected }),
    );
  });

  it("returns early when not a subscription invoice", async () => {
    const event = makeEvent("invoice.paid", {
      id: "in_test_123",
      parent: { type: "quote" },
    });

    await routeWebhookEvent(event, "space-1", "tenant-1");

    expect(mockGrantMonthlyCredits).not.toHaveBeenCalled();
  });

  it("returns early when member not found", async () => {
    memberSelectResult = null;

    const event = makeEvent("invoice.paid", makeInvoice());

    await routeWebhookEvent(event, "space-1", "tenant-1");

    expect(mockGrantMonthlyCredits).not.toHaveBeenCalled();
  });
});

// =========================================================================
// invoice.payment_failed
// =========================================================================

describe("invoice.payment_failed", () => {
  it("marks member as past_due", async () => {
    const event = makeEvent("invoice.payment_failed", makeInvoice());

    await routeWebhookEvent(event, "space-1", "tenant-1");

    const memberUpdate = updateCalls.find((c) => c.table === "members");
    expect(memberUpdate).toBeDefined();
    expect(memberUpdate!.data).toEqual(
      expect.objectContaining({ status: "past_due" }),
    );
  });

  it("returns early when not a subscription invoice", async () => {
    const event = makeEvent("invoice.payment_failed", {
      id: "in_test_123",
      parent: { type: "quote" },
    });

    await routeWebhookEvent(event, "space-1", "tenant-1");

    expect(updateCalls).toHaveLength(0);
  });
});

// =========================================================================
// customer.subscription.updated
// =========================================================================

describe("customer.subscription.updated", () => {
  it("maps cancel_at_period_end to cancelling status", async () => {
    memberSelectResult = { id: "member-1", plan_id: "plan-xyz", status: "active" };

    const event = makeEvent("customer.subscription.updated", {
      id: "sub_test_123",
      cancel_at_period_end: true,
      status: "active",
      metadata: {},
    });

    await routeWebhookEvent(event, "space-1", "tenant-1");

    const memberUpdate = updateCalls.find((c) => c.table === "members");
    expect(memberUpdate!.data).toEqual(
      expect.objectContaining({ status: "cancelling" }),
    );
  });

  it("maps active subscription to active status", async () => {
    memberSelectResult = { id: "member-1", plan_id: "plan-xyz", status: "past_due" };

    const event = makeEvent("customer.subscription.updated", {
      id: "sub_test_123",
      cancel_at_period_end: false,
      status: "active",
      metadata: {},
    });

    await routeWebhookEvent(event, "space-1", "tenant-1");

    const memberUpdate = updateCalls.find((c) => c.table === "members");
    expect(memberUpdate!.data).toEqual(
      expect.objectContaining({ status: "active" }),
    );
  });

  it("maps past_due subscription to past_due status", async () => {
    memberSelectResult = { id: "member-1", plan_id: "plan-xyz", status: "active" };

    const event = makeEvent("customer.subscription.updated", {
      id: "sub_test_123",
      cancel_at_period_end: false,
      status: "past_due",
      metadata: {},
    });

    await routeWebhookEvent(event, "space-1", "tenant-1");

    const memberUpdate = updateCalls.find((c) => c.table === "members");
    expect(memberUpdate!.data).toEqual(
      expect.objectContaining({ status: "past_due" }),
    );
  });

  it("maps unpaid subscription to past_due status", async () => {
    memberSelectResult = { id: "member-1", plan_id: "plan-xyz", status: "active" };

    const event = makeEvent("customer.subscription.updated", {
      id: "sub_test_123",
      cancel_at_period_end: false,
      status: "unpaid",
      metadata: {},
    });

    await routeWebhookEvent(event, "space-1", "tenant-1");

    const memberUpdate = updateCalls.find((c) => c.table === "members");
    expect(memberUpdate!.data).toEqual(
      expect.objectContaining({ status: "past_due" }),
    );
  });

  it("maps paused subscription to paused status", async () => {
    memberSelectResult = { id: "member-1", plan_id: "plan-xyz", status: "active" };

    const event = makeEvent("customer.subscription.updated", {
      id: "sub_test_123",
      cancel_at_period_end: false,
      status: "paused",
      metadata: {},
    });

    await routeWebhookEvent(event, "space-1", "tenant-1");

    const memberUpdate = updateCalls.find((c) => c.table === "members");
    expect(memberUpdate!.data).toEqual(
      expect.objectContaining({ status: "paused" }),
    );
  });

  it("updates plan when plan_id changes and new plan exists", async () => {
    memberSelectResult = { id: "member-1", plan_id: "plan-old", status: "active" };
    planSelectResult = { id: "plan-new" };

    const event = makeEvent("customer.subscription.updated", {
      id: "sub_test_123",
      cancel_at_period_end: false,
      status: "active",
      metadata: { plan_id: "plan-new" },
    });

    await routeWebhookEvent(event, "space-1", "tenant-1");

    const memberUpdate = updateCalls.find((c) => c.table === "members");
    expect(memberUpdate!.data).toEqual(
      expect.objectContaining({ plan_id: "plan-new" }),
    );
  });

  it("does not update plan when new plan does not exist", async () => {
    memberSelectResult = { id: "member-1", plan_id: "plan-old", status: "active" };
    planSelectResult = null;

    const event = makeEvent("customer.subscription.updated", {
      id: "sub_test_123",
      cancel_at_period_end: false,
      status: "active",
      metadata: { plan_id: "plan-nonexistent" },
    });

    await routeWebhookEvent(event, "space-1", "tenant-1");

    const memberUpdate = updateCalls.find((c) => c.table === "members");
    expect(memberUpdate!.data).not.toHaveProperty("plan_id");
  });

  it("does not update plan when plan_id unchanged", async () => {
    memberSelectResult = { id: "member-1", plan_id: "plan-xyz", status: "active" };

    const event = makeEvent("customer.subscription.updated", {
      id: "sub_test_123",
      cancel_at_period_end: false,
      status: "active",
      metadata: { plan_id: "plan-xyz" },
    });

    await routeWebhookEvent(event, "space-1", "tenant-1");

    const memberUpdate = updateCalls.find((c) => c.table === "members");
    expect(memberUpdate!.data).not.toHaveProperty("plan_id");
  });

  it("returns early when member not found", async () => {
    memberSelectResult = null;

    const event = makeEvent("customer.subscription.updated", {
      id: "sub_test_123",
      cancel_at_period_end: false,
      status: "active",
      metadata: {},
    });

    await routeWebhookEvent(event, "space-1", "tenant-1");

    expect(updateCalls.find((c) => c.table === "members")).toBeUndefined();
  });
});

// =========================================================================
// customer.subscription.deleted
// =========================================================================

describe("customer.subscription.deleted", () => {
  it("marks member as churned and expires credits", async () => {
    memberSelectResult = { id: "member-1", user_id: "user-abc" };

    const event = makeEvent("customer.subscription.deleted", {
      id: "sub_test_123",
    });

    await routeWebhookEvent(event, "space-1", "tenant-1");

    // Should mark as churned
    const memberUpdate = updateCalls.find((c) => c.table === "members");
    expect(memberUpdate!.data).toEqual(
      expect.objectContaining({
        status: "churned",
        cancelled_at: "2026-03-15T12:00:00.000Z",
      }),
    );

    // Should expire credits
    expect(mockExpireRenewableCredits).toHaveBeenCalledWith({
      spaceId: "space-1",
      userId: "user-abc",
    });
  });

  it("returns early when member not found", async () => {
    memberSelectResult = null;

    const event = makeEvent("customer.subscription.deleted", {
      id: "sub_test_123",
    });

    await routeWebhookEvent(event, "space-1", "tenant-1");

    expect(updateCalls.find((c) => c.table === "members")).toBeUndefined();
    expect(mockExpireRenewableCredits).not.toHaveBeenCalled();
  });
});
