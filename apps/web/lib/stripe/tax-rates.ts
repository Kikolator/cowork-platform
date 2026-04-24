import "server-only";
import { getStripe } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Lazily create and cache a Stripe TaxRate on a connected account.
 * Returns null when ivaRate is 0 (no tax applied).
 *
 * The TaxRate ID is cached on `spaces.stripe_tax_rate_id`. When the
 * rate or inclusive setting changes, the admin action clears the cache
 * so a fresh TaxRate is created on the next checkout.
 */
export async function ensureStripeTaxRateExists(params: {
  spaceId: string;
  connectedAccountId: string;
  ivaRate: number;
  inclusive: boolean;
  displayName?: string;
}): Promise<string | null> {
  if (params.ivaRate === 0) return null;

  const admin = createAdminClient();
  const stripe = getStripe();

  // Check cached TaxRate ID
  const { data: space } = await admin
    .from("spaces")
    .select("stripe_tax_rate_id")
    .eq("id", params.spaceId)
    .single();

  const cachedId = space?.stripe_tax_rate_id ?? null;
  if (cachedId) {
    try {
      const existing = await stripe.taxRates.retrieve(
        cachedId,
        { stripeAccount: params.connectedAccountId },
      );
      if (
        existing.active &&
        existing.percentage === params.ivaRate &&
        existing.inclusive === params.inclusive
      ) {
        return existing.id;
      }
      // Rate or inclusive mismatch — archive old, create new
      await stripe.taxRates.update(
        existing.id,
        { active: false },
        { stripeAccount: params.connectedAccountId },
      );
    } catch {
      // Not found on this account — create fresh
    }
  }

  const taxRate = await stripe.taxRates.create(
    {
      display_name: params.displayName ?? "IVA",
      percentage: params.ivaRate,
      inclusive: params.inclusive,
      tax_type: "vat",
    },
    { stripeAccount: params.connectedAccountId },
  );

  await admin
    .from("spaces")
    .update({ stripe_tax_rate_id: taxRate.id })
    .eq("id", params.spaceId);

  return taxRate.id;
}
