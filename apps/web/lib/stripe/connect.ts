import "server-only";
import { getStripe } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Create or retrieve a Stripe Connect account for a tenant.
 * Uses Standard type — tenant gets full Stripe dashboard.
 */
export async function getOrCreateConnectAccount(
  tenantId: string,
  existingAccountId: string | null,
  businessName: string,
  email: string,
): Promise<string> {
  if (existingAccountId) {
    try {
      await getStripe().accounts.retrieve(existingAccountId);
      return existingAccountId;
    } catch {
      // Account was deleted in Stripe — create a new one
    }
  }

  const account = await getStripe().accounts.create({
    type: "standard",
    business_profile: {
      name: businessName,
    },
    email,
    metadata: {
      tenant_id: tenantId,
    },
  });

  return account.id;
}

/**
 * Create an Account Link for the Stripe hosted onboarding flow.
 */
export async function createAccountLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string,
): Promise<string> {
  const accountLink = await getStripe().accountLinks.create({
    account: accountId,
    return_url: returnUrl,
    refresh_url: refreshUrl,
    type: "account_onboarding",
  });

  return accountLink.url;
}

/**
 * Check if a connected account has completed onboarding.
 */
export async function isAccountOnboarded(accountId: string): Promise<{
  complete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}> {
  const account = await getStripe().accounts.retrieve(accountId);

  return {
    complete: account.charges_enabled && account.payouts_enabled,
    chargesEnabled: account.charges_enabled ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
    detailsSubmitted: account.details_submitted ?? false,
  };
}

/**
 * Verify a tenant's Stripe account is ready for payments.
 * Call before any Stripe API call on a connected account.
 */
export async function verifyStripeReady(tenantId: string): Promise<string> {
  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("stripe_account_id, stripe_onboarding_complete")
    .eq("id", tenantId)
    .single();

  if (!tenant?.stripe_account_id) {
    throw new Error(
      "Stripe not connected. Go to Settings to connect your Stripe account.",
    );
  }

  if (!tenant.stripe_onboarding_complete) {
    throw new Error(
      "Stripe setup incomplete. Complete onboarding in Settings.",
    );
  }

  return tenant.stripe_account_id;
}
