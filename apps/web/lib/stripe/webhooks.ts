import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { grantMonthlyCredits, expireRenewableCredits } from "@/lib/credits/grant";

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

    // Payment events (space-level)
    case "checkout.session.completed":
      await handleCheckoutCompleted(event, spaceId!);
      break;
    case "invoice.paid":
      await handleInvoicePaid(event, spaceId!);
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event, spaceId!);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event, spaceId!);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event, spaceId!);
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

async function handleCheckoutCompleted(event: Stripe.Event, spaceId: string) {
  const session = event.data.object as Stripe.Checkout.Session;
  const category = session.metadata?.product_category;

  if (session.mode === "subscription") {
    await handleSubscriptionCheckout(session, spaceId);
  } else if (session.mode === "payment") {
    switch (category) {
      case "pass":
        await handlePassCheckout(session, spaceId);
        break;
      case "hour_bundle":
        await handleHourBundleCheckout(session, spaceId);
        break;
      case "deposit":
      case "event":
        // No special handling — payment is logged in payment_events by the main route handler
        break;
      default:
        console.warn(`Unknown product category in checkout: ${category}`);
    }
  }
}

async function handleSubscriptionCheckout(
  session: Stripe.Checkout.Session,
  spaceId: string,
) {
  const userId = session.metadata?.user_id;
  const planId = session.metadata?.plan_id;
  const metadataSpaceId = session.metadata?.space_id;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!userId || !planId || !customerId || !subscriptionId) {
    console.error("Checkout session missing required metadata", {
      userId,
      planId,
      customerId,
      subscriptionId,
    });
    return;
  }

  // Verify space matches
  if (metadataSpaceId && metadataSpaceId !== spaceId) {
    console.error(
      `Space mismatch: event space ${spaceId}, metadata space ${metadataSpaceId}`,
    );
    return;
  }

  const admin = createAdminClient();

  // Check for existing member
  const { data: existingMember } = await admin
    .from("members")
    .select("id, status")
    .eq("user_id", userId)
    .eq("space_id", spaceId)
    .maybeSingle();

  if (existingMember) {
    // Reactivate churned member or update existing
    await admin
      .from("members")
      .update({
        plan_id: planId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        status: "active",
        joined_at: new Date().toISOString(),
        cancelled_at: null,
        cancel_requested_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingMember.id);
  } else {
    // Create new member
    await admin.from("members").insert({
      space_id: spaceId,
      user_id: userId,
      plan_id: planId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      status: "active",
      joined_at: new Date().toISOString(),
    });
  }

  // Ensure space_users record exists
  await admin.from("space_users").upsert(
    {
      user_id: userId,
      space_id: spaceId,
      role: "member",
    },
    { onConflict: "user_id,space_id", ignoreDuplicates: true },
  );
}

async function handlePassCheckout(
  session: Stripe.Checkout.Session,
  spaceId: string,
) {
  const passId = session.metadata?.pass_id;
  const userId = session.metadata?.user_id;
  if (!passId || !userId) {
    console.error("Pass checkout missing metadata", { passId, userId });
    return;
  }

  const admin = createAdminClient();

  // Activate the pass using the RPC
  const { error: activateError } = await admin.rpc("activate_pass", {
    p_space_id: spaceId,
    p_user_id: userId,
    p_stripe_session_id: session.id,
  });

  if (activateError) {
    console.error("Failed to activate pass:", activateError);
    return;
  }

  // Auto-assign desk
  const { data: pass } = await admin
    .from("passes")
    .select("start_date, end_date")
    .eq("id", passId)
    .single();

  if (pass) {
    const { data: deskId } = await admin.rpc("auto_assign_desk", {
      p_space_id: spaceId,
      p_start_date: pass.start_date,
      p_end_date: pass.end_date,
    });

    if (deskId) {
      await admin
        .from("passes")
        .update({ assigned_desk_id: deskId })
        .eq("id", passId);
    } else {
      console.warn(`No desk available for pass ${passId} — pass still active`);
    }
  }
}

async function handleHourBundleCheckout(
  session: Stripe.Checkout.Session,
  spaceId: string,
) {
  const productId = session.metadata?.product_id;
  const userId = session.metadata?.user_id;
  if (!productId || !userId) {
    console.error("Hour bundle checkout missing metadata", { productId, userId });
    return;
  }

  const admin = createAdminClient();

  // Fetch product credit grant config
  const { data: product } = await admin
    .from("products")
    .select("credit_grant_config")
    .eq("id", productId)
    .single();

  if (!product?.credit_grant_config) {
    console.error(`Product ${productId} has no credit_grant_config`);
    return;
  }

  const config = product.credit_grant_config as unknown as {
    resource_type_id: string;
    minutes: number;
  };

  if (!config.resource_type_id || !config.minutes) {
    console.error(`Product ${productId} has invalid credit_grant_config`, config);
    return;
  }

  // Get a line item ID for idempotency
  const lineItemId = session.id; // Use session ID as idempotency key for one-off purchases

  await admin.rpc("grant_credits", {
    p_space_id: spaceId,
    p_user_id: userId,
    p_resource_type_id: config.resource_type_id,
    p_amount_minutes: config.minutes,
    p_source: "purchase",
    p_valid_from: new Date().toISOString(),
    // Purchased credits don't expire
    p_stripe_line_item_id: lineItemId,
  });
}

async function handleInvoicePaid(event: Stripe.Event, spaceId: string) {
  const invoice = event.data.object as Stripe.Invoice;

  // In the new Stripe API, subscription is under parent.subscription_details
  const subscriptionId =
    invoice.parent?.type === "subscription_details"
      ? (typeof invoice.parent.subscription_details?.subscription === "string"
          ? invoice.parent.subscription_details.subscription
          : invoice.parent.subscription_details?.subscription?.id ?? null)
      : null;
  if (!subscriptionId) return; // Not a subscription invoice

  const invoiceId = invoice.id;
  const billingReason = invoice.billing_reason;

  // Look up member
  const admin = createAdminClient();
  const { data: member } = await admin
    .from("members")
    .select("id, user_id, plan_id, status")
    .eq("stripe_subscription_id", subscriptionId)
    .eq("space_id", spaceId)
    .maybeSingle();

  if (!member) {
    console.warn(
      "Member not found for invoice.paid — checkout handler may not have run yet",
      { subscriptionId, spaceId },
    );
    return;
  }

  // If past_due, payment succeeded — reactivate
  if (member.status === "past_due") {
    await admin
      .from("members")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", member.id);
  }

  // On renewal, expire previous month's credits first
  if (billingReason === "subscription_cycle") {
    await expireRenewableCredits({
      spaceId,
      userId: member.user_id,
    });
  }

  // Calculate valid_until from the subscription's current period end
  // The invoice lines contain the period info
  const periodEnd = invoice.lines?.data?.[0]?.period?.end;
  const validUntil = periodEnd
    ? new Date(periodEnd * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Fallback: 30 days

  // Grant credits
  await grantMonthlyCredits({
    spaceId,
    userId: member.user_id,
    planId: member.plan_id,
    stripeInvoiceId: invoiceId,
    validUntil,
  });
}

async function handleInvoicePaymentFailed(
  event: Stripe.Event,
  spaceId: string,
) {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId =
    invoice.parent?.type === "subscription_details"
      ? (typeof invoice.parent.subscription_details?.subscription === "string"
          ? invoice.parent.subscription_details.subscription
          : invoice.parent.subscription_details?.subscription?.id ?? null)
      : null;
  if (!subscriptionId) return;

  const admin = createAdminClient();
  await admin
    .from("members")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscriptionId)
    .eq("space_id", spaceId);
}

async function handleSubscriptionUpdated(
  event: Stripe.Event,
  spaceId: string,
) {
  const subscription = event.data.object as Stripe.Subscription;
  const subscriptionId = subscription.id;

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("members")
    .select("id, plan_id, status")
    .eq("stripe_subscription_id", subscriptionId)
    .eq("space_id", spaceId)
    .maybeSingle();

  if (!member) return;

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  // Check for plan change via metadata
  const newPlanId = subscription.metadata?.plan_id;
  if (newPlanId && newPlanId !== member.plan_id) {
    // Verify the plan exists
    const { data: plan } = await admin
      .from("plans")
      .select("id")
      .eq("id", newPlanId)
      .maybeSingle();

    if (plan) {
      updates.plan_id = newPlanId;
    }
  }

  // Map status
  if (subscription.cancel_at_period_end) {
    updates.status = "cancelling";
  } else {
    switch (subscription.status) {
      case "active":
        updates.status = "active";
        break;
      case "past_due":
      case "unpaid":
        updates.status = "past_due";
        break;
      case "paused":
        updates.status = "paused";
        break;
      // 'canceled' handled by subscription.deleted
    }
  }

  await admin.from("members").update(updates).eq("id", member.id);
}

async function handleSubscriptionDeleted(
  event: Stripe.Event,
  spaceId: string,
) {
  const subscription = event.data.object as Stripe.Subscription;
  const subscriptionId = subscription.id;

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("members")
    .select("id, user_id")
    .eq("stripe_subscription_id", subscriptionId)
    .eq("space_id", spaceId)
    .maybeSingle();

  if (!member) return;

  await admin
    .from("members")
    .update({
      status: "churned",
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", member.id);

  // Expire all renewable credits
  await expireRenewableCredits({
    spaceId,
    userId: member.user_id,
  });
}
