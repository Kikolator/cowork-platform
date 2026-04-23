import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mock Stripe client ────────────────────────────────────────────────────

const mockSessionsRetrieve = vi.fn();
const mockRefundsCreate = vi.fn();

vi.mock("./client", () => ({
  getStripe: () => ({
    checkout: { sessions: { retrieve: mockSessionsRetrieve } },
    refunds: { create: mockRefundsCreate },
  }),
}));

import { refundPassPayment } from "./refunds";

// ── refundPassPayment ─────────────────────────────────────────────────────

describe("refundPassPayment", () => {
  const BASE_PARAMS = {
    stripeSessionId: "cs_live_daypass_session_abc123",
    connectedAccountId: "acct_cowork_urbanhive_001",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Happy path ──────────────────────────────────────────────────────────

  it("creates a full refund when amountCents is omitted", async () => {
    mockSessionsRetrieve.mockResolvedValue({
      payment_intent: "pi_daypass_payment_abc123",
    });
    mockRefundsCreate.mockResolvedValue({
      id: "re_refund_001",
      amount: 2500,
    });

    const result = await refundPassPayment(BASE_PARAMS);

    expect(result).toEqual({
      refundId: "re_refund_001",
      amountRefunded: 2500,
    });
    expect(mockRefundsCreate).toHaveBeenCalledWith(
      {
        payment_intent: "pi_daypass_payment_abc123",
        reason: "requested_by_customer",
      },
      { stripeAccount: "acct_cowork_urbanhive_001" },
    );
  });

  it("creates a partial refund when amountCents is provided", async () => {
    mockSessionsRetrieve.mockResolvedValue({
      payment_intent: "pi_weekpass_payment_xyz789",
    });
    mockRefundsCreate.mockResolvedValue({
      id: "re_partial_001",
      amount: 1500,
    });

    const result = await refundPassPayment({
      ...BASE_PARAMS,
      amountCents: 1500,
    });

    expect(result).toEqual({
      refundId: "re_partial_001",
      amountRefunded: 1500,
    });
    expect(mockRefundsCreate).toHaveBeenCalledWith(
      {
        payment_intent: "pi_weekpass_payment_xyz789",
        amount: 1500,
        reason: "requested_by_customer",
      },
      { stripeAccount: "acct_cowork_urbanhive_001" },
    );
  });

  it("retrieves the checkout session on the connected account", async () => {
    mockSessionsRetrieve.mockResolvedValue({
      payment_intent: "pi_test",
    });
    mockRefundsCreate.mockResolvedValue({ id: "re_test", amount: 100 });

    await refundPassPayment(BASE_PARAMS);

    expect(mockSessionsRetrieve).toHaveBeenCalledWith(
      "cs_live_daypass_session_abc123",
      { stripeAccount: "acct_cowork_urbanhive_001" },
    );
  });

  it("handles payment_intent as an expanded object", async () => {
    mockSessionsRetrieve.mockResolvedValue({
      payment_intent: { id: "pi_expanded_obj_001", status: "succeeded" },
    });
    mockRefundsCreate.mockResolvedValue({
      id: "re_expanded_001",
      amount: 3000,
    });

    const result = await refundPassPayment(BASE_PARAMS);

    expect(result.refundId).toBe("re_expanded_001");
    expect(mockRefundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent: "pi_expanded_obj_001",
      }),
      expect.anything(),
    );
  });

  // ── Error handling ──────────────────────────────────────────────────────

  it("throws when payment_intent is null", async () => {
    mockSessionsRetrieve.mockResolvedValue({
      payment_intent: null,
    });

    await expect(refundPassPayment(BASE_PARAMS)).rejects.toThrow(
      "No payment intent found for this checkout session",
    );
    expect(mockRefundsCreate).not.toHaveBeenCalled();
  });

  it("throws when payment_intent is missing entirely", async () => {
    mockSessionsRetrieve.mockResolvedValue({});

    await expect(refundPassPayment(BASE_PARAMS)).rejects.toThrow(
      "No payment intent found for this checkout session",
    );
  });

  it("propagates Stripe API errors from session retrieve", async () => {
    const stripeError = new Error("No such checkout session: cs_invalid");
    mockSessionsRetrieve.mockRejectedValue(stripeError);

    await expect(refundPassPayment(BASE_PARAMS)).rejects.toThrow(
      "No such checkout session: cs_invalid",
    );
  });

  it("propagates Stripe API errors from refund creation", async () => {
    mockSessionsRetrieve.mockResolvedValue({
      payment_intent: "pi_already_refunded",
    });
    const stripeError = new Error("Charge has already been refunded");
    mockRefundsCreate.mockRejectedValue(stripeError);

    await expect(refundPassPayment(BASE_PARAMS)).rejects.toThrow(
      "Charge has already been refunded",
    );
  });

  it("does not include amount field for full refund", async () => {
    mockSessionsRetrieve.mockResolvedValue({
      payment_intent: "pi_full_refund",
    });
    mockRefundsCreate.mockResolvedValue({ id: "re_full", amount: 5000 });

    await refundPassPayment(BASE_PARAMS);

    const [refundArgs] = mockRefundsCreate.mock.calls[0] as [Record<string, unknown>];
    expect(refundArgs).not.toHaveProperty("amount");
  });
});
