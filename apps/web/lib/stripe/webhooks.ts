import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export async function routeWebhookEvent(
  event: Stripe.Event,
  spaceId: string | null,
  tenantId: string | null,
) {
  switch (event.type) {
    // Connect account events (platform-level)
    case "account.updated":
      await handleAccountUpdated(event);
      break;

    // Payment events (space-level — implemented in next task)
    case "checkout.session.completed":
      // await handleCheckoutCompleted(event, spaceId!);
      break;
    case "invoice.paid":
      // await handleInvoicePaid(event, spaceId!);
      break;
    case "invoice.payment_failed":
      // await handleInvoicePaymentFailed(event, spaceId!);
      break;
    case "customer.subscription.updated":
      // await handleSubscriptionUpdated(event, spaceId!);
      break;
    case "customer.subscription.deleted":
      // await handleSubscriptionDeleted(event, spaceId!);
      break;

    default:
      console.log(`Unhandled webhook event: ${event.type}`);
  }
}

async function handleAccountUpdated(event: Stripe.Event) {
  const account = event.data.object as Stripe.Account;
  const admin = createAdminClient();

  const onboardingComplete =
    (account.charges_enabled ?? false) && (account.payouts_enabled ?? false);

  await admin
    .from("tenants")
    .update({ stripe_onboarding_complete: onboardingComplete })
    .eq("stripe_account_id", account.id);
}
