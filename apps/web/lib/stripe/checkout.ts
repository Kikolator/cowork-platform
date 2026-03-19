import "server-only";
import type Stripe from "stripe";
import { getStripe } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateApplicationFee } from "./fees";

/**
 * Ensure a one-time Stripe Product + Price exists for a product on the connected account.
 * Creates them lazily if missing, then saves the IDs to the product record.
 */
export async function ensureOneTimePriceExists(
  product: {
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
  if (product.stripe_price_id) return product.stripe_price_id;

  let stripeProductId = product.stripe_product_id;

  if (!stripeProductId) {
    const stripeProduct = await getStripe().products.create(
      {
        name: product.name,
        metadata: { space_id: spaceId, product_id: product.id },
      },
      { stripeAccount: connectedAccountId },
    );
    stripeProductId = stripeProduct.id;
  }

  const price = await getStripe().prices.create(
    {
      product: stripeProductId,
      unit_amount: product.price_cents,
      currency: product.currency,
      metadata: { space_id: spaceId, product_id: product.id },
    },
    { stripeAccount: connectedAccountId },
  );

  const admin = createAdminClient();
  await admin
    .from("products")
    .update({
      stripe_product_id: stripeProductId,
      stripe_price_id: price.id,
    })
    .eq("id", product.id);

  return price.id;
}

/**
 * Ensure a recurring Stripe Price exists for an addon product.
 */
export async function ensureRecurringAddonPriceExists(
  product: {
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
  if (product.stripe_price_id) return product.stripe_price_id;

  let stripeProductId = product.stripe_product_id;

  if (!stripeProductId) {
    const stripeProduct = await getStripe().products.create(
      {
        name: product.name,
        metadata: { space_id: spaceId, product_id: product.id },
      },
      { stripeAccount: connectedAccountId },
    );
    stripeProductId = stripeProduct.id;
  }

  const price = await getStripe().prices.create(
    {
      product: stripeProductId,
      unit_amount: product.price_cents,
      currency: product.currency,
      recurring: { interval: "month" },
      metadata: { space_id: spaceId, product_id: product.id },
    },
    { stripeAccount: connectedAccountId },
  );

  const admin = createAdminClient();
  await admin
    .from("products")
    .update({
      stripe_product_id: stripeProductId,
      stripe_price_id: price.id,
    })
    .eq("id", product.id);

  return price.id;
}

/**
 * Create a one-off Stripe Checkout session on the connected account.
 */
export async function createOneTimeCheckoutSession(params: {
  customerId: string;
  priceId: string;
  amountCents: number;
  feePercent: number;
  connectedAccountId: string;
  spaceId: string;
  productId: string;
  productCategory: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
  extraMetadata?: Record<string, string>;
}): Promise<Stripe.Checkout.Session> {
  return getStripe().checkout.sessions.create(
    {
      mode: "payment",
      customer: params.customerId,
      line_items: [{ price: params.priceId, quantity: 1 }],
      payment_intent_data: {
        application_fee_amount: calculateApplicationFee(
          params.amountCents,
          params.feePercent,
        ),
      },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        space_id: params.spaceId,
        product_id: params.productId,
        product_category: params.productCategory,
        user_id: params.userId,
        ...params.extraMetadata,
      },
    },
    { stripeAccount: params.connectedAccountId },
  );
}
