import "server-only";

import { getStripe } from "./client";

/**
 * Refund a pass payment via the Stripe connected account.
 *
 * Retrieves the checkout session to get the payment_intent, then creates
 * a refund on the connected account. Returns the refund details.
 */
export async function refundPassPayment(params: {
  stripeSessionId: string;
  connectedAccountId: string;
  amountCents?: number; // omit for full refund
}): Promise<{ refundId: string; amountRefunded: number }> {
  const stripe = getStripe();

  // Retrieve the checkout session to get the payment_intent
  const session = await stripe.checkout.sessions.retrieve(
    params.stripeSessionId,
    { stripeAccount: params.connectedAccountId },
  );

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  if (!paymentIntentId) {
    throw new Error("No payment intent found for this checkout session");
  }

  // Create the refund
  const refund = await stripe.refunds.create(
    {
      payment_intent: paymentIntentId,
      ...(params.amountCents ? { amount: params.amountCents } : {}),
      reason: "requested_by_customer",
    },
    { stripeAccount: params.connectedAccountId },
  );

  return {
    refundId: refund.id,
    amountRefunded: refund.amount,
  };
}
