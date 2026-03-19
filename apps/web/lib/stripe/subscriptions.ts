import "server-only";
import type Stripe from "stripe";
import { getStripe } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Ensure a Stripe Product + Price exists for a plan on the connected account.
 * Creates them lazily if missing, then saves the IDs to the plan record.
 */
export async function ensureStripePriceExists(
  plan: {
    id: string;
    name: string;
    price_cents: number;
    currency: string;
    stripe_price_id: string | null;
    stripe_product_id: string | null;
  },
  connectedAccountId: string,
  spaceId: string,
): Promise<string> {
  if (plan.stripe_price_id) return plan.stripe_price_id;

  const product = await getStripe().products.create(
    {
      name: plan.name,
      metadata: { space_id: spaceId, plan_id: plan.id },
    },
    { stripeAccount: connectedAccountId },
  );

  const price = await getStripe().prices.create(
    {
      product: product.id,
      unit_amount: plan.price_cents,
      currency: plan.currency,
      recurring: { interval: "month" },
      metadata: { space_id: spaceId, plan_id: plan.id },
    },
    { stripeAccount: connectedAccountId },
  );

  const admin = createAdminClient();
  await admin
    .from("plans")
    .update({
      stripe_product_id: product.id,
      stripe_price_id: price.id,
    })
    .eq("id", plan.id);

  return price.id;
}

/**
 * Create a Stripe Checkout session for a subscription on the connected account.
 */
export async function createCheckoutSession(params: {
  customerId: string;
  priceId: string;
  connectedAccountId: string;
  feePercent: number;
  spaceId: string;
  planId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  return getStripe().checkout.sessions.create(
    {
      mode: "subscription",
      customer: params.customerId,
      line_items: [{ price: params.priceId, quantity: 1 }],
      subscription_data: {
        application_fee_percent: params.feePercent,
        metadata: {
          space_id: params.spaceId,
          plan_id: params.planId,
          user_id: params.userId,
        },
      },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        space_id: params.spaceId,
        plan_id: params.planId,
        user_id: params.userId,
      },
    },
    { stripeAccount: params.connectedAccountId },
  );
}

/**
 * Find or create a Stripe Customer on a connected account.
 */
export async function findOrCreateCustomer(params: {
  email: string;
  name: string | null;
  existingCustomerId: string | null;
  connectedAccountId: string;
  spaceId: string;
  userId: string;
}): Promise<string> {
  if (params.existingCustomerId) {
    try {
      await getStripe().customers.retrieve(params.existingCustomerId, {
        stripeAccount: params.connectedAccountId,
      });
      return params.existingCustomerId;
    } catch {
      // Customer was deleted — create a new one
    }
  }

  const customer = await getStripe().customers.create(
    {
      email: params.email,
      name: params.name ?? undefined,
      metadata: { space_id: params.spaceId, user_id: params.userId },
    },
    { stripeAccount: params.connectedAccountId },
  );

  return customer.id;
}

/**
 * Update a Stripe subscription to a new price (plan change).
 */
export async function updateSubscriptionPrice(params: {
  subscriptionId: string;
  newPriceId: string;
  newPlanId: string;
  connectedAccountId: string;
}): Promise<Stripe.Subscription> {
  const subscription = await getStripe().subscriptions.retrieve(
    params.subscriptionId,
    { stripeAccount: params.connectedAccountId },
  );

  const itemId = subscription.items.data[0]?.id;
  if (!itemId) throw new Error("Subscription has no items");

  return getStripe().subscriptions.update(
    params.subscriptionId,
    {
      items: [{ id: itemId, price: params.newPriceId }],
      proration_behavior: "create_prorations",
      metadata: { plan_id: params.newPlanId },
    },
    { stripeAccount: params.connectedAccountId },
  );
}

/**
 * Cancel a subscription at period end.
 */
export async function cancelSubscriptionAtPeriodEnd(
  subscriptionId: string,
  connectedAccountId: string,
): Promise<Stripe.Subscription> {
  return getStripe().subscriptions.update(
    subscriptionId,
    { cancel_at_period_end: true },
    { stripeAccount: connectedAccountId },
  );
}

/**
 * Resume a subscription that was scheduled for cancellation.
 */
export async function resumeSubscriptionCancellation(
  subscriptionId: string,
  connectedAccountId: string,
): Promise<Stripe.Subscription> {
  return getStripe().subscriptions.update(
    subscriptionId,
    { cancel_at_period_end: false },
    { stripeAccount: connectedAccountId },
  );
}
