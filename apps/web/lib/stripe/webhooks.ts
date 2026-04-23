import "server-only";
import type Stripe from "stripe";
import { createLogger } from "@cowork/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { grantMonthlyCredits, expireRenewableCredits, expirePurchasedCredits } from "@/lib/credits/grant";
import { deleteNukiCodeForMember } from "@/lib/nuki/sync";
import { applyReferrerDiscountCoupon } from "@/lib/stripe/coupons";
import { notifySpaceSignup, notifyPassConfirmation, notifyNewPassPurchase } from "@/lib/email/notifications";

export async function routeWebhookEvent(
  event: Stripe.Event,
  spaceId: string | null,
  tenantId: string | null,
) {
  const logger = createLogger({ component: "stripe/webhooks", spaceId: spaceId ?? undefined, tenantId: tenantId ?? undefined });

  switch (event.type) {
    // Connect account events (platform-level)
    case "account.updated":
      await handleAccountUpdated(event);
      break;

    // Payment events (space-level — require spaceId)
    case "checkout.session.completed":
    case "invoice.paid":
    case "invoice.payment_failed":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      if (!spaceId) {
        logger.error("Event received but no spaceId resolved for connected account", { eventType: event.type });
        break;
      }
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutCompleted(event, spaceId);
          break;
        case "invoice.paid":
          await handleInvoicePaid(event, spaceId);
          break;
        case "invoice.payment_failed":
          await handleInvoicePaymentFailed(event, spaceId);
          break;
        case "customer.subscription.updated":
          await handleSubscriptionUpdated(event, spaceId);
          break;
        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(event, spaceId);
          break;
      }
      break;
    }

    default:
      logger.info("Unhandled webhook event", { eventType: event.type });
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

  // Guest checkout flow (from marketing landing page)
  if (session.metadata?.guest_checkout === "true") {
    await handleGuestCheckout(session, spaceId);
    return;
  }

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
        createLogger({ component: "stripe/webhooks", spaceId }).warn("Unknown product category in checkout", { category });
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

  const logger = createLogger({ component: "stripe/webhooks", spaceId, handler: "subscriptionCheckout" });

  if (!userId || !planId || !customerId || !subscriptionId) {
    logger.error("Checkout session missing required metadata", {
      userId,
      planId,
      customerId,
      subscriptionId,
    });
    return;
  }

  // Verify space matches
  if (metadataSpaceId && metadataSpaceId !== spaceId) {
    logger.error("Space mismatch", {
      eventSpaceId: spaceId,
      metadataSpaceId,
    });
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
    const { error: updateErr } = await admin
      .from("members")
      .update({
        plan_id: planId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        billing_mode: "stripe",
        status: "active",
        joined_at: new Date().toISOString(),
        cancelled_at: null,
        cancel_requested_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingMember.id);

    if (updateErr) {
      logger.error("Failed to update existing member", { memberId: existingMember.id, error: updateErr.message });
      throw new Error(`Member update failed: ${updateErr.message}`);
    }
  } else {
    // Create new member
    const { error: insertErr } = await admin.from("members").insert({
      space_id: spaceId,
      user_id: userId,
      plan_id: planId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      billing_mode: "stripe",
      status: "active",
      joined_at: new Date().toISOString(),
    });

    if (insertErr) {
      logger.error("Failed to create member", { userId, error: insertErr.message });
      throw new Error(`Member insert failed: ${insertErr.message}`);
    }
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

  // Handle referral completion if this checkout was referred
  const referralId = session.metadata?.referral_id;
  if (referralId) {
    const memberId = existingMember?.id
      ?? (await admin.from("members").select("id").eq("user_id", userId).eq("space_id", spaceId).single()).data?.id;

    if (memberId) {
      await handleReferralCompletion(referralId, userId, memberId, spaceId);
    }
  }
}

async function handlePassCheckout(
  session: Stripe.Checkout.Session,
  spaceId: string,
) {
  const passId = session.metadata?.pass_id;
  const userId = session.metadata?.user_id;
  const logger = createLogger({ component: "stripe/webhooks", spaceId, handler: "passCheckout" });

  if (!passId || !userId) {
    logger.error("Pass checkout missing metadata", { passId, userId });
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
    logger.error("Failed to activate pass", { error: activateError.message });
    return;
  }

  // Auto-assign desk
  const { data: pass } = await admin
    .from("passes")
    .select("start_date, end_date, pass_type")
    .eq("id", passId)
    .single();

  if (!pass) return;

  const { data: deskId, error: deskError } = await admin.rpc("auto_assign_desk", {
    p_space_id: spaceId,
    p_start_date: pass.start_date,
    p_end_date: pass.end_date,
  });

  if (deskError) {
    logger.error("auto_assign_desk RPC failed", { passId, error: deskError.message });
  } else if (deskId) {
    await admin
      .from("passes")
      .update({ assigned_desk_id: deskId })
      .eq("id", passId);
  } else {
    logger.warn("No desk available for pass — pass still active", { passId });
  }

  // Persist community_rules_accepted_at on the pass if accepted
  const communityRulesAccepted = session.metadata?.community_rules_accepted === "true";
  if (communityRulesAccepted) {
    await admin
      .from("passes")
      .update({ community_rules_accepted_at: new Date().toISOString() } as Record<string, unknown>)
      .eq("id", passId);
  }

  // Send pass confirmation email (fire-and-forget)
  const user = await admin
    .from("shared_profiles")
    .select("email, full_name")
    .eq("id", userId)
    .single();

  let deskName: string | null = null;
  if (deskId) {
    const { data: desk } = await admin
      .from("resources")
      .select("name")
      .eq("id", deskId as string)
      .single();
    deskName = desk?.name ?? null;
  }

  if (user.data?.email) {
    notifyPassConfirmation({
      spaceId,
      userId,
      email: user.data.email,
      name: user.data.full_name ?? undefined,
      passType: pass.pass_type ?? "day",
      startDate: pass.start_date,
      endDate: pass.end_date,
      deskName,
    });

    // Notify space owner
    notifyNewPassPurchase({
      spaceId,
      visitorName: user.data.full_name ?? null,
      visitorEmail: user.data.email,
      passType: pass.pass_type ?? "day",
      startDate: pass.start_date,
      endDate: pass.end_date,
      amountCents: session.amount_total ?? 0,
      currency: session.currency ?? "eur",
    });
  }
}

async function handleHourBundleCheckout(
  session: Stripe.Checkout.Session,
  spaceId: string,
) {
  const productId = session.metadata?.product_id;
  const userId = session.metadata?.user_id;
  const logger = createLogger({ component: "stripe/webhooks", spaceId, handler: "hourBundleCheckout" });

  if (!productId || !userId) {
    logger.error("Hour bundle checkout missing metadata", { productId, userId });
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
    logger.error("Product has no credit_grant_config", { productId });
    return;
  }

  const config = product.credit_grant_config as unknown as {
    resource_type_id: string;
    minutes: number;
  };

  if (!config.resource_type_id || !config.minutes) {
    logger.error("Product has invalid credit_grant_config", { productId, config });
    return;
  }

  // Get a line item ID for idempotency
  const lineItemId = session.id; // Use session ID as idempotency key for one-off purchases

  const { error: grantError } = await admin.rpc("grant_credits", {
    p_space_id: spaceId,
    p_user_id: userId,
    p_resource_type_id: config.resource_type_id,
    p_amount_minutes: config.minutes,
    p_source: "purchase",
    p_valid_from: new Date().toISOString(),
    // Purchased credits don't expire
    p_stripe_line_item_id: lineItemId,
  });

  if (grantError) {
    logger.error("Failed to grant credits for hour bundle purchase", { userId, productId, error: grantError.message });
    throw new Error(`grant_credits failed: ${grantError.message}`);
  }
}

async function handleInvoicePaid(event: Stripe.Event, spaceId: string) {
  const logger = createLogger({ component: "stripe/webhooks", spaceId, handler: "invoicePaid" });
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
    logger.warn(
      "Member not found for invoice.paid — checkout handler may not have run yet",
      { subscriptionId },
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

  // Grant credits (skip if member has no plan assigned)
  if (member.plan_id) {
    await grantMonthlyCredits({
      spaceId,
      userId: member.user_id,
      planId: member.plan_id,
      stripeInvoiceId: invoiceId,
      validUntil,
    });
  }
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

  // Expire all credits — subscription credits and purchased credits
  // Purchased credits are only valid while the plan is active
  await expireRenewableCredits({
    spaceId,
    userId: member.user_id,
  });
  await expirePurchasedCredits({
    spaceId,
    userId: member.user_id,
  });

  // Delete Nuki keypad code if Nuki integration is enabled
  await deleteNukiCodeForMember(spaceId, member.id);
}

async function handleGuestCheckout(
  session: Stripe.Checkout.Session,
  spaceId: string,
) {
  const logger = createLogger({ component: "stripe/webhooks", spaceId, handler: "guestCheckout" });

  // Only proceed if payment is confirmed
  if (session.payment_status !== "paid") {
    logger.warn("Guest checkout session not paid, skipping", {
      sessionId: session.id,
      paymentStatus: session.payment_status,
    });
    return;
  }

  const metadata = session.metadata ?? {};
  const email = metadata.email;
  const name = metadata.name;
  const type = metadata.type; // "daypass" | "membership"

  if (!email || !type) {
    logger.error("Guest checkout missing required metadata", { metadata });
    return;
  }

  const admin = createAdminClient();

  // Upsert user via admin API
  let userId: string;
  const { data: newUser, error: createError } =
    await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: name ? { name } : {},
    });

  if (createError) {
    // User already exists — look them up by email
    const { data: userData } = await admin
      .from("shared_profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    const existingUser = userData ? { id: userData.id } : null;
    if (!existingUser) {
      logger.error("Failed to create or find user for guest checkout", {
        email,
        error: createError.message,
      });
      return;
    }
    userId = existingUser.id;
  } else {
    userId = newUser.user.id;
  }

  if (type === "daypass") {
    const today = new Date().toISOString().split("T")[0]!;
    const amountTotal = session.amount_total ?? 0;

    const { data: pass, error: passError } = await admin
      .from("passes")
      .insert({
        space_id: spaceId,
        user_id: userId,
        pass_type: "day" as const,
        status: "active" as const,
        start_date: today,
        end_date: today,
        stripe_session_id: session.id,
        amount_cents: amountTotal,
        is_guest: false,
      })
      .select("id, start_date, end_date")
      .single();

    if (passError) {
      logger.error("Failed to create pass for guest checkout", { error: passError.message });
      return;
    }

    // Auto-assign desk
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
          .eq("id", pass.id);
      }
    }
  } else if (type === "product") {
    // Product-based guest pass checkout — create pass from Stripe metadata
    const productId = metadata.product_id;
    const passTypeStr = metadata.pass_type;
    const startDate = metadata.start_date;
    const endDate = metadata.end_date;
    const communityRulesAccepted = metadata.community_rules_accepted === "true";

    if (!productId || !passTypeStr || !startDate || !endDate) {
      logger.error("Product guest checkout missing required metadata", { metadata });
      return;
    }

    const amountTotal = session.amount_total ?? 0;
    const today = new Date().toISOString().split("T")[0]!;
    const passStatus = startDate > today ? "upcoming" : "active";
    const passInsert = {
      space_id: spaceId,
      user_id: userId,
      pass_type: passTypeStr as "day" | "week",
      status: passStatus as "active",  // upcoming not yet in generated types
      start_date: startDate,
      end_date: endDate,
      stripe_session_id: session.id,
      amount_cents: amountTotal,
      is_guest: false,
    };
    // New columns not yet in generated types
    Object.assign(passInsert, {
      product_id: productId,
      ...(communityRulesAccepted
        ? { community_rules_accepted_at: new Date().toISOString() }
        : {}),
    });

    const { data: pass, error: passError } = await admin
      .from("passes")
      .insert(passInsert)
      .select("id, start_date, end_date")
      .single();

    if (passError) {
      logger.error("Failed to create pass for product guest checkout", { error: passError.message });
      return;
    }

    // Auto-assign desk
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
          .eq("id", pass.id);
      }

      // Fetch desk name for email
      let deskName: string | null = null;
      if (deskId) {
        const { data: desk } = await admin
          .from("resources")
          .select("name")
          .eq("id", deskId)
          .single();
        deskName = desk?.name ?? null;
      }

      // Send pass confirmation email (fire-and-forget)
      notifyPassConfirmation({
        spaceId,
        userId,
        email,
        name: name ?? undefined,
        passType: passTypeStr as "day" | "week",
        startDate,
        endDate,
        deskName,
      });

      // Notify space owner
      notifyNewPassPurchase({
        spaceId,
        visitorName: name ?? null,
        visitorEmail: email,
        passType: passTypeStr as "day" | "week",
        startDate,
        endDate,
        amountCents: amountTotal,
        currency: session.currency ?? "eur",
      });
    }
  } else if (type === "membership") {
    const planSlug = metadata.plan_slug;
    const planId = metadata.plan_id;
    const communityRulesAccepted = metadata.community_rules_accepted === "true";
    const customerId =
      typeof session.customer === "string" ? session.customer : null;
    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : null;

    if (!planId && !planSlug) {
      logger.error("Guest membership checkout missing plan info", { metadata });
      return;
    }

    // Resolve plan_id from slug if not in metadata
    let resolvedPlanId: string | undefined = planId;
    if (!resolvedPlanId && planSlug) {
      const { data: plan } = await admin
        .from("plans")
        .select("id")
        .eq("space_id", spaceId)
        .eq("slug", planSlug)
        .single();
      resolvedPlanId = plan?.id ?? undefined;
    }

    if (!resolvedPlanId) {
      logger.error("Could not resolve plan for guest checkout", { planSlug });
      return;
    }

    // Check for existing member
    const { data: existingMember } = await admin
      .from("members")
      .select("id")
      .eq("user_id", userId)
      .eq("space_id", spaceId)
      .maybeSingle();

    if (existingMember) {
      const memberUpdate = {
        plan_id: resolvedPlanId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        status: "active" as const,
        joined_at: new Date().toISOString(),
        cancelled_at: null,
        cancel_requested_at: null,
        updated_at: new Date().toISOString(),
      };
      if (communityRulesAccepted) {
        Object.assign(memberUpdate, {
          community_rules_accepted_at: new Date().toISOString(),
        });
      }
      await admin
        .from("members")
        .update(memberUpdate)
        .eq("id", existingMember.id);
    } else {
      const memberInsert = {
        space_id: spaceId,
        user_id: userId,
        plan_id: resolvedPlanId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        status: "active" as const,
        joined_at: new Date().toISOString(),
      };
      // community_rules_accepted_at not yet in generated types
      if (communityRulesAccepted) {
        Object.assign(memberInsert, {
          community_rules_accepted_at: new Date().toISOString(),
        });
      }
      await admin.from("members").insert(memberInsert);
    }
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

  // Resolve space slug for redirect URL
  const { data: spaceData } = await admin
    .from("spaces")
    .select("slug, custom_domain")
    .eq("id", spaceId)
    .single();

  const platformDomain =
    process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "localhost:3000";
  const proto = platformDomain.startsWith("localhost") ? "http" : "https";
  const spaceOrigin = spaceData?.custom_domain
    ? `${proto}://${spaceData.custom_domain}`
    : `${proto}://${spaceData?.slug ?? "app"}.${platformDomain}`;
  const redirectTo = `${spaceOrigin}/auth/callback`;

  // Send magic link email with correct space redirect
  const { error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  if (linkError) {
    logger.error("Failed to send magic link after guest checkout", {
      email,
      error: linkError.message,
    });
  }

  // Fire-and-forget welcome email
  notifySpaceSignup({ spaceId, userId, email, name: name ?? undefined });
}

async function handleReferralCompletion(
  referralId: string,
  referredUserId: string,
  referredMemberId: string,
  spaceId: string,
) {
  const logger = createLogger({ component: "stripe/webhooks", spaceId, handler: "referralCompletion", referralId });
  const admin = createAdminClient();

  // Atomically transition status from pending → completed (prevents double-processing)
  const { data: referral } = await admin
    .from("referrals")
    .update({
      status: "completed",
      referred_user_id: referredUserId,
      referred_member_id: referredMemberId,
      completed_at: new Date().toISOString(),
    })
    .eq("id", referralId)
    .eq("status", "pending")
    .select("id, referral_code_id, referrer_member_id, referrer_user_id")
    .maybeSingle();

  if (!referral) {
    return; // Already processed, expired, or not found
  }

  // Load program config
  const { data: program } = await admin
    .from("referral_programs")
    .select(
      "referrer_reward_type, referrer_credit_minutes, referrer_credit_resource_type_id, referrer_discount_percent, referrer_discount_months",
    )
    .eq("space_id", spaceId)
    .eq("active", true)
    .maybeSingle();

  // Increment uses_count — safe because the atomic status guard above
  // ensures only one invocation reaches this point per referral
  const { data: codeData } = await admin
    .from("referral_codes")
    .select("uses_count")
    .eq("id", referral.referral_code_id)
    .single();

  if (codeData) {
    await admin
      .from("referral_codes")
      .update({ uses_count: codeData.uses_count + 1 })
      .eq("id", referral.referral_code_id);
  }

  // Fulfill referrer reward
  let rewardApplied = false;
  let creditGrantId: string | null = null;
  let referrerCouponId: string | null = null;
  const rewardType = program?.referrer_reward_type ?? "none";

  if (program && rewardType === "credit" && program.referrer_credit_minutes && program.referrer_credit_resource_type_id) {
    const { data: grantId } = await admin.rpc("grant_credits", {
      p_space_id: spaceId,
      p_user_id: referral.referrer_user_id,
      p_resource_type_id: program.referrer_credit_resource_type_id,
      p_source: "referral",
      p_amount_minutes: program.referrer_credit_minutes,
      p_valid_from: new Date().toISOString(),
      p_metadata: JSON.stringify({ referral_id: referralId }),
    });

    creditGrantId = grantId;
    rewardApplied = !!grantId;
  } else if (program && rewardType === "discount" && program.referrer_discount_percent && program.referrer_discount_months) {
    // Apply discount coupon to referrer's subscription
    const { data: referrerMember } = await admin
      .from("members")
      .select("stripe_subscription_id")
      .eq("id", referral.referrer_member_id)
      .single();

    if (referrerMember?.stripe_subscription_id) {
      const { data: spaceData } = await admin
        .from("spaces")
        .select("tenant_id")
        .eq("id", spaceId)
        .single();

      const { data: tenantData } = spaceData?.tenant_id
        ? await admin
            .from("tenants")
            .select("stripe_account_id")
            .eq("id", spaceData.tenant_id)
            .single()
        : { data: null };

      if (tenantData?.stripe_account_id) {
        try {
          referrerCouponId = await applyReferrerDiscountCoupon({
            percentOff: program.referrer_discount_percent,
            durationMonths: program.referrer_discount_months,
            subscriptionId: referrerMember.stripe_subscription_id,
            connectedAccountId: tenantData.stripe_account_id,
            spaceId,
            referralId,
          });
          rewardApplied = true;
        } catch (err) {
          logger.error("Failed to apply referrer discount coupon", {
            error: String(err),
          });
        }
      } else {
        logger.error("Could not apply referrer discount — missing Stripe account", {
          referrerMemberId: referral.referrer_member_id,
        });
      }
    } else {
      logger.error("Could not apply referrer discount — no active subscription", {
        referrerMemberId: referral.referrer_member_id,
      });
    }
  } else if (rewardType === "none") {
    rewardApplied = true; // No reward to apply
  }

  // Only mark as rewarded if the reward was actually applied
  if (rewardApplied) {
    await admin
      .from("referrals")
      .update({
        referrer_rewarded: true,
        referrer_reward_type: rewardType,
        ...(creditGrantId && { referrer_credit_grant_id: creditGrantId }),
        ...(referrerCouponId && { referrer_stripe_coupon_id: referrerCouponId }),
      })
      .eq("id", referralId);
  }

  // Create admin notification as member note on referrer's record
  const { data: referredProfile } = await admin
    .from("shared_profiles")
    .select("full_name, email")
    .eq("id", referredUserId)
    .maybeSingle();

  const referredName = referredProfile?.full_name ?? referredProfile?.email ?? "Someone";

  await admin.from("member_notes").insert({
    space_id: spaceId,
    member_id: referral.referrer_member_id,
    author_id: referral.referrer_user_id,
    content: `[System] Referral completed: ${referredName} joined via referral code.${rewardApplied && rewardType === "credit" ? ` Referrer was awarded ${program?.referrer_credit_minutes} minutes of credits.` : ""}${rewardApplied && rewardType === "discount" ? ` Referrer received ${program?.referrer_discount_percent}% discount for ${program?.referrer_discount_months} month(s).` : ""}${!rewardApplied ? " Reward could not be applied — admin review required." : ""}`,
    category: "billing",
  });
}
