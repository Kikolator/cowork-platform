"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createLogger } from "@cowork/shared";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSpaceUrlFromHeaders } from "@/lib/url";
import { verifyStripeReady } from "@/lib/stripe/connect";
import { getEffectiveFeePercent } from "@/lib/stripe/fees";
import { findOrCreateCustomer } from "@/lib/stripe/subscriptions";
import {
  ensureOneTimePriceExists,
  ensureRecurringAddonPriceExists,
  createOneTimeCheckoutSession,
} from "@/lib/stripe/checkout";
import { getStripe } from "@/lib/stripe/client";
import { ensureStripeTaxRateExists } from "@/lib/stripe/tax-rates";
import { isProductVisible } from "@/lib/products/visibility";

async function getSpaceContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const spaceId = user.app_metadata?.space_id as string | undefined;
  if (!spaceId) throw new Error("No space context");
  const tenantId = user.app_metadata?.tenant_id as string | undefined;
  if (!tenantId) throw new Error("No tenant context");
  return { supabase, user, spaceId, tenantId };
}

async function buildSpaceUrl(slug: string, path: string): Promise<string> {
  const h = await headers();
  return buildSpaceUrlFromHeaders(slug, path, h);
}

export async function getDateAvailability(date: string): Promise<{
  available: boolean;
  reason?: string;
  desks: number;
}> {
  const { supabase, spaceId } = await getSpaceContext();

  // Check closures
  const { data: closure } = await supabase
    .from("space_closures")
    .select("id")
    .eq("space_id", spaceId)
    .eq("date", date)
    .maybeSingle();

  if (closure) return { available: false, reason: "closed", desks: 0 };

  // Check desk availability via RPC
  const { data } = await supabase.rpc("get_desk_availability", {
    p_space_id: spaceId,
    p_date: date,
  });

  const row = data?.[0];
  const availableDesks = row?.available_desks ?? 0;

  return { available: availableDesks > 0, desks: availableDesks };
}

export async function purchasePass(
  productId: string,
  startDate: string,
  isGuest: boolean,
  guestName?: string,
  guestEmail?: string,
  communityRulesAccepted?: boolean,
): Promise<{ success: true; url: string } | { success: false; error: string }> {
  try {
    const { user, spaceId, tenantId } = await getSpaceContext();
    const admin = createAdminClient();

    // Fetch product
    const { data: product } = await admin
      .from("products")
      .select("*")
      .eq("id", productId)
      .eq("space_id", spaceId)
      .single();

    if (!product) return { success: false, error: "Product not found" };
    if (!product.active) return { success: false, error: "Product is no longer available" };
    if (product.category !== "pass") return { success: false, error: "Invalid product category" };

    // Verify visibility rules
    const { data: member } = await admin
      .from("members")
      .select("id, plan_id, status, stripe_customer_id")
      .eq("user_id", user.id)
      .eq("space_id", spaceId)
      .maybeSingle();

    let unlimitedResourceTypeIds: string[] = [];
    if (member?.plan_id) {
      const { data: configs } = await admin
        .from("plan_credit_config")
        .select("resource_type_id, is_unlimited")
        .eq("plan_id", member.plan_id);
      unlimitedResourceTypeIds =
        configs?.filter((c) => c.is_unlimited).map((c) => c.resource_type_id) ?? [];
    }

    const productResourceTypeId = (
      product.credit_grant_config as { resource_type_id?: string } | null
    )?.resource_type_id;

    if (
      !isProductVisible(
        product.visibility_rules,
        {
          isMember: member?.status === "active",
          planId: member?.plan_id ?? null,
          unlimitedResourceTypeIds,
        },
        productResourceTypeId,
      )
    ) {
      return { success: false, error: "This product is not available for your membership" };
    }

    // Check features
    const { data: space } = await admin
      .from("spaces")
      .select("slug, features")
      .eq("id", spaceId)
      .single();

    const features = (space?.features ?? {}) as Record<string, boolean>;
    if (features.passes === false) {
      return { success: false, error: "Passes are not enabled for this space" };
    }
    if (isGuest && features.guest_passes === false) {
      return { success: false, error: "Guest passes are not enabled" };
    }

    // Determine pass type and end date
    const passType = product.slug.includes("week") ? "week" : "day";
    let endDate = startDate;
    if (passType === "week") {
      // 5 business days: start_date + 4 calendar days (Mon-Fri)
      const start = new Date(startDate);
      start.setDate(start.getDate() + 4);
      endDate = start.toISOString().split("T")[0]!;
    }

    // Check availability
    const availability = await getDateAvailability(startDate);
    if (!availability.available) {
      return {
        success: false,
        error: availability.reason === "closed"
          ? "The space is closed on this date"
          : "No desks available on this date",
      };
    }

    // Create pending pass record
    const { data: passRecord, error: passError } = await admin
      .from("passes")
      .insert({
        space_id: spaceId,
        user_id: user.id,
        pass_type: passType as "day" | "week",
        status: "pending_payment",
        start_date: startDate,
        end_date: endDate,
        amount_cents: product.price_cents,
        is_guest: isGuest,
        purchased_by: isGuest ? user.id : null,
      })
      .select("id")
      .single();

    if (passError || !passRecord) {
      return { success: false, error: "Failed to create pass record" };
    }

    // Stripe setup
    const { stripeAccountId, platformPlan, platformFeePercent } =
      await verifyStripeReady(tenantId);
    const feePercent = getEffectiveFeePercent(platformPlan, platformFeePercent);

    // Resolve tax rate
    const { data: taxCfg } = await admin
      .from("spaces")
      .select("default_iva_rate, tax_inclusive")
      .eq("id", spaceId)
      .single();
    const taxRateId = await ensureStripeTaxRateExists({
      spaceId,
      connectedAccountId: stripeAccountId,
      ivaRate: taxCfg?.default_iva_rate ?? 21,
      inclusive: taxCfg?.tax_inclusive ?? true,
    }) ?? undefined;

    // Get or create customer (reuse member from visibility check above)
    const customerId = await findOrCreateCustomer({
      email: user.email ?? "",
      name: user.user_metadata?.full_name ?? null,
      existingCustomerId: member?.stripe_customer_id ?? null,
      connectedAccountId: stripeAccountId,
      spaceId,
      userId: user.id,
    });

    // Ensure one-time Stripe price
    const priceId = await ensureOneTimePriceExists(product, stripeAccountId, spaceId);

    const slug = space?.slug ?? "";
    const successUrl = await buildSpaceUrl(slug, "/store/success?session_id={CHECKOUT_SESSION_ID}");
    const cancelUrl = await buildSpaceUrl(slug, "/store");
    const session = await createOneTimeCheckoutSession({
      customerId,
      priceId,
      amountCents: product.price_cents,
      feePercent,
      connectedAccountId: stripeAccountId,
      spaceId,
      productId,
      productCategory: "pass",
      userId: user.id,
      successUrl,
      cancelUrl,
      taxRateId,
      extraMetadata: {
        pass_id: passRecord.id,
        ...(isGuest && guestName ? { guest_name: guestName } : {}),
        ...(isGuest && guestEmail ? { guest_email: guestEmail } : {}),
        ...(communityRulesAccepted ? { community_rules_accepted: "true" } : {}),
      },
    });

    // Save stripe session ID to pass — critical for webhook matching
    const { error: updateError } = await admin
      .from("passes")
      .update({ stripe_session_id: session.id })
      .eq("id", passRecord.id);

    if (updateError) {
      createLogger({ component: "store/actions", spaceId }).error("Failed to save stripe_session_id to pass", {
        passId: passRecord.id,
        sessionId: session.id,
        error: updateError.message,
      });
      return { success: false, error: "Failed to link payment session" };
    }

    if (!session.url) {
      return { success: false, error: "Failed to create checkout session" };
    }

    return { success: true, url: session.url };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Something went wrong",
    };
  }
}

export async function purchaseProduct(
  productId: string,
): Promise<{ success: true; url: string } | { success: false; error: string }> {
  try {
    const { user, spaceId, tenantId } = await getSpaceContext();
    const admin = createAdminClient();

    // Fetch product
    const { data: product } = await admin
      .from("products")
      .select("*")
      .eq("id", productId)
      .eq("space_id", spaceId)
      .single();

    if (!product) return { success: false, error: "Product not found" };
    if (!product.active) return { success: false, error: "Product is no longer available" };

    // Verify visibility
    const { data: member } = await admin
      .from("members")
      .select("id, plan_id, status, stripe_customer_id")
      .eq("user_id", user.id)
      .eq("space_id", spaceId)
      .maybeSingle();

    // Check which resource types member has unlimited credits for
    let unlimitedResourceTypeIds: string[] = [];
    if (member?.plan_id) {
      const { data: configs } = await admin
        .from("plan_credit_config")
        .select("resource_type_id, is_unlimited")
        .eq("plan_id", member.plan_id);
      unlimitedResourceTypeIds =
        configs?.filter((c) => c.is_unlimited).map((c) => c.resource_type_id) ?? [];
    }

    const productResourceTypeId = (
      product.credit_grant_config as { resource_type_id?: string } | null
    )?.resource_type_id;

    const memberContext = {
      isMember: member?.status === "active",
      planId: member?.plan_id ?? null,
      unlimitedResourceTypeIds,
    };

    if (!isProductVisible(product.visibility_rules, memberContext, productResourceTypeId)) {
      return { success: false, error: "This product is not available for your membership" };
    }

    // Check features
    const { data: space } = await admin
      .from("spaces")
      .select("slug, features")
      .eq("id", spaceId)
      .single();

    const features = (space?.features ?? {}) as Record<string, boolean>;
    if (product.category === "hour_bundle" && features.credits === false) {
      return { success: false, error: "Credit bundles are not enabled" };
    }

    // Stripe setup
    const { stripeAccountId, platformPlan, platformFeePercent } =
      await verifyStripeReady(tenantId);
    const feePercent = getEffectiveFeePercent(platformPlan, platformFeePercent);

    // Resolve tax rate
    const { data: taxCfg2 } = await admin
      .from("spaces")
      .select("default_iva_rate, tax_inclusive")
      .eq("id", spaceId)
      .single();
    const taxRateId = await ensureStripeTaxRateExists({
      spaceId,
      connectedAccountId: stripeAccountId,
      ivaRate: taxCfg2?.default_iva_rate ?? 21,
      inclusive: taxCfg2?.tax_inclusive ?? true,
    }) ?? undefined;

    const customerId = await findOrCreateCustomer({
      email: user.email ?? "",
      name: user.user_metadata?.full_name ?? null,
      existingCustomerId: member?.stripe_customer_id ?? null,
      connectedAccountId: stripeAccountId,
      spaceId,
      userId: user.id,
    });

    // Ensure one-time Stripe price
    const priceId = await ensureOneTimePriceExists(product, stripeAccountId, spaceId);

    const slug = space?.slug ?? "";
    const successUrl = await buildSpaceUrl(slug, "/store/success?session_id={CHECKOUT_SESSION_ID}");
    const cancelUrl = await buildSpaceUrl(slug, "/store");
    const session = await createOneTimeCheckoutSession({
      customerId,
      priceId,
      amountCents: product.price_cents,
      feePercent,
      connectedAccountId: stripeAccountId,
      spaceId,
      productId,
      productCategory: product.category,
      userId: user.id,
      successUrl,
      cancelUrl,
      taxRateId,
    });

    if (!session.url) {
      return { success: false, error: "Failed to create checkout session" };
    }

    return { success: true, url: session.url };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Something went wrong",
    };
  }
}

export async function purchaseAddon(
  productId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { user, spaceId, tenantId } = await getSpaceContext();
    const admin = createAdminClient();

    // Fetch member (must be active with subscription)
    const { data: member } = await admin
      .from("members")
      .select("id, stripe_subscription_id, status, has_twenty_four_seven")
      .eq("user_id", user.id)
      .eq("space_id", spaceId)
      .single();

    if (!member) return { success: false, error: "No active membership found" };
    if (member.status !== "active" && member.status !== "cancelling") {
      return { success: false, error: "Subscription must be active to add add-ons" };
    }
    if (!member.stripe_subscription_id) {
      return { success: false, error: "No subscription found" };
    }

    // Fetch product
    const { data: product } = await admin
      .from("products")
      .select("*")
      .eq("id", productId)
      .eq("space_id", spaceId)
      .single();

    if (!product) return { success: false, error: "Product not found" };
    if (!product.active) return { success: false, error: "Product is no longer available" };
    if (product.category !== "addon") return { success: false, error: "Invalid product category" };

    const { stripeAccountId } = await verifyStripeReady(tenantId);

    // Ensure recurring price for addon
    const priceId = await ensureRecurringAddonPriceExists(
      product,
      stripeAccountId,
      spaceId,
    );

    // Add line item to existing subscription
    let subscription;
    try {
      subscription = await getStripe().subscriptions.retrieve(
        member.stripe_subscription_id,
        { stripeAccount: stripeAccountId },
      );
    } catch (err) {
      createLogger({ component: "store/actions", spaceId }).error("Failed to retrieve subscription for addon", {
        subscriptionId: member.stripe_subscription_id,
        error: err instanceof Error ? err.message : "Unknown error",
      });
      return { success: false, error: "Failed to retrieve subscription" };
    }

    const existingItems = subscription.items.data.map((item) => ({
      id: item.id,
    }));

    try {
      await getStripe().subscriptions.update(
        member.stripe_subscription_id,
        {
          items: [...existingItems, { price: priceId }],
          proration_behavior: "create_prorations",
        },
        { stripeAccount: stripeAccountId },
      );
    } catch (err) {
      createLogger({ component: "store/actions", spaceId }).error("Failed to add addon to subscription", {
        subscriptionId: member.stripe_subscription_id,
        error: err instanceof Error ? err.message : "Unknown error",
      });
      return { success: false, error: "Failed to add addon to subscription" };
    }

    // For 24/7 access addon, update the member record
    if (product.slug.includes("24-7") || product.slug.includes("twenty-four-seven")) {
      const { error: memberUpdateErr } = await admin
        .from("members")
        .update({ has_twenty_four_seven: true, updated_at: new Date().toISOString() })
        .eq("id", member.id);

      if (memberUpdateErr) {
        createLogger({ component: "store/actions", spaceId }).error("Failed to update member addon flag", {
          memberId: member.id,
          error: memberUpdateErr.message,
        });
      }
    }

    revalidatePath("/store");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Something went wrong",
    };
  }
}
