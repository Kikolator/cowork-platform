import "server-only";
import type Stripe from "stripe";
import { getStripe } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyStripeReady } from "./connect";
import { getEffectiveFeePercent } from "./fees";
import { grantMonthlyCredits } from "@/lib/credits/grant";

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

  let stripeProductId = plan.stripe_product_id;

  if (!stripeProductId) {
    const product = await getStripe().products.create(
      {
        name: plan.name,
        metadata: { space_id: spaceId, plan_id: plan.id },
      },
      { stripeAccount: connectedAccountId },
    );
    stripeProductId = product.id;
  }

  const price = await getStripe().prices.create(
    {
      product: stripeProductId,
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
      stripe_product_id: stripeProductId,
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
  couponId?: string;
  referralId?: string;
  taxRateId?: string;
}): Promise<Stripe.Checkout.Session> {
  return getStripe().checkout.sessions.create(
    {
      mode: "subscription",
      customer: params.customerId,
      line_items: [
        {
          price: params.priceId,
          quantity: 1,
          ...(params.taxRateId && { tax_rates: [params.taxRateId] }),
        },
      ],
      ...(params.couponId && {
        discounts: [{ coupon: params.couponId }],
      }),
      subscription_data: {
        application_fee_percent: params.feePercent,
        ...(params.taxRateId && {
          default_tax_rates: [params.taxRateId],
        }),
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
        ...(params.referralId && { referral_id: params.referralId }),
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

/**
 * Provision a Stripe customer + subscription for a member.
 * Used when adding a member with Stripe billing or switching from manual to Stripe.
 * Creates the subscription with send_invoice collection (no card required upfront).
 * Updates the member record with stripe_customer_id, stripe_subscription_id, and billing_mode.
 */
export async function provisionSubscription(params: {
  memberId: string;
  userId: string;
  planId: string;
  spaceId: string;
  tenantId: string;
  customPriceCents: number | null;
  taxRateId?: string;
}): Promise<void> {
  const admin = createAdminClient();

  const { stripeAccountId, platformPlan, platformFeePercent } =
    await verifyStripeReady(params.tenantId);
  const feePercent = getEffectiveFeePercent(platformPlan, platformFeePercent);

  // Get member's profile for customer creation
  const { data: profile } = await admin
    .from("shared_profiles")
    .select("email, full_name")
    .eq("id", params.userId)
    .single();

  if (!profile?.email) throw new Error("Member profile not found");

  // Get existing stripe_customer_id if any
  const { data: member } = await admin
    .from("members")
    .select("stripe_customer_id")
    .eq("id", params.memberId)
    .single();

  const customerId = await findOrCreateCustomer({
    email: profile.email,
    name: profile.full_name ?? null,
    existingCustomerId: member?.stripe_customer_id ?? null,
    connectedAccountId: stripeAccountId,
    spaceId: params.spaceId,
    userId: params.userId,
  });

  // Get plan for price creation
  const { data: plan } = await admin
    .from("plans")
    .select("id, name, price_cents, currency, stripe_price_id, stripe_product_id")
    .eq("id", params.planId)
    .single();

  if (!plan) throw new Error("Plan not found");

  const effectivePrice = params.customPriceCents ?? plan.price_cents;

  let priceId: string;
  if (params.customPriceCents != null && params.customPriceCents !== plan.price_cents) {
    let productId = plan.stripe_product_id;
    if (!productId) {
      await ensureStripePriceExists(plan, stripeAccountId, params.spaceId);
      const { data: refreshedPlan } = await admin
        .from("plans")
        .select("stripe_product_id")
        .eq("id", plan.id)
        .single();
      productId = refreshedPlan?.stripe_product_id ?? null;
    }

    if (!productId) throw new Error("Could not resolve Stripe product");

    const customPrice = await getStripe().prices.create(
      {
        product: productId,
        unit_amount: effectivePrice,
        currency: plan.currency,
        recurring: { interval: "month" },
        metadata: { space_id: params.spaceId, plan_id: plan.id, custom_for_member: params.memberId },
      },
      { stripeAccount: stripeAccountId },
    );
    priceId = customPrice.id;
  } else {
    priceId = await ensureStripePriceExists(plan, stripeAccountId, params.spaceId);
  }

  const subscription = await getStripe().subscriptions.create(
    {
      customer: customerId,
      items: [{ price: priceId }],
      collection_method: "send_invoice",
      days_until_due: 7,
      application_fee_percent: feePercent,
      ...(params.taxRateId && {
        default_tax_rates: [params.taxRateId],
      }),
      metadata: {
        space_id: params.spaceId,
        plan_id: params.planId,
        user_id: params.userId,
      },
    },
    { stripeAccount: stripeAccountId },
  );

  const { error: updateError } = await admin
    .from("members")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      billing_mode: "stripe",
    })
    .eq("id", params.memberId);

  if (updateError) {
    throw new Error(
      `Member record update failed after Stripe subscription created (sub: ${subscription.id}): ${updateError.message}`,
    );
  }

  // Grant initial credits immediately — send_invoice subscriptions create
  // a draft invoice, so invoice.paid won't fire until the customer pays.
  // Without this, admin-provisioned members have 0 credits.
  const periodEnd = subscription.items.data[0]?.current_period_end;
  const validUntil = periodEnd
    ? new Date(periodEnd * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await grantMonthlyCredits({
    spaceId: params.spaceId,
    userId: params.userId,
    planId: params.planId,
    stripeInvoiceId: `provision_initial_${subscription.id}`,
    validUntil,
  });
}
