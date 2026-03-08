"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyStripeReady } from "@/lib/stripe/connect";
import { findOrCreateCustomer } from "@/lib/stripe/subscriptions";
import {
  ensureOneTimePriceExists,
  ensureRecurringAddonPriceExists,
  createOneTimeCheckoutSession,
} from "@/lib/stripe/checkout";
import { stripe } from "@/lib/stripe/client";
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

function getOrigin(slug: string): string {
  const protocol = process.env.NEXT_PUBLIC_PROTOCOL ?? "https";
  const domain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "cowork.app";
  return `${protocol}://${slug}.${domain}`;
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

    let isUnlimited = false;
    if (member?.plan_id) {
      const { data: configs } = await admin
        .from("plan_credit_config")
        .select("is_unlimited")
        .eq("plan_id", member.plan_id);
      isUnlimited = configs?.some((c) => c.is_unlimited) ?? false;
    }

    if (
      !isProductVisible(product.visibility_rules, {
        isMember: member?.status === "active",
        planId: member?.plan_id ?? null,
        isUnlimited,
      })
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
    const connectedAccountId = await verifyStripeReady(tenantId);

    // Get or create customer (reuse member from visibility check above)
    const customerId = await findOrCreateCustomer({
      email: user.email ?? "",
      name: user.user_metadata?.full_name ?? null,
      existingCustomerId: member?.stripe_customer_id ?? null,
      connectedAccountId,
      spaceId,
      userId: user.id,
    });

    // Ensure one-time Stripe price
    const priceId = await ensureOneTimePriceExists(product, connectedAccountId, spaceId);

    const origin = getOrigin(space?.slug ?? "");
    const session = await createOneTimeCheckoutSession({
      customerId,
      priceId,
      amountCents: product.price_cents,
      connectedAccountId,
      spaceId,
      productId,
      productCategory: "pass",
      userId: user.id,
      successUrl: `${origin}/store/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/store`,
      extraMetadata: {
        pass_id: passRecord.id,
        ...(isGuest && guestName ? { guest_name: guestName } : {}),
        ...(isGuest && guestEmail ? { guest_email: guestEmail } : {}),
      },
    });

    // Save stripe session ID to pass
    await admin
      .from("passes")
      .update({ stripe_session_id: session.id })
      .eq("id", passRecord.id);

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

    // Check if member has unlimited credits (for visibility filtering)
    let isUnlimited = false;
    if (member?.plan_id) {
      const { data: configs } = await admin
        .from("plan_credit_config")
        .select("is_unlimited")
        .eq("plan_id", member.plan_id);
      isUnlimited = configs?.some((c) => c.is_unlimited) ?? false;
    }

    const memberContext = {
      isMember: member?.status === "active",
      planId: member?.plan_id ?? null,
      isUnlimited,
    };

    if (!isProductVisible(product.visibility_rules, memberContext)) {
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
    const connectedAccountId = await verifyStripeReady(tenantId);

    const customerId = await findOrCreateCustomer({
      email: user.email ?? "",
      name: user.user_metadata?.full_name ?? null,
      existingCustomerId: member?.stripe_customer_id ?? null,
      connectedAccountId,
      spaceId,
      userId: user.id,
    });

    // Ensure one-time Stripe price
    const priceId = await ensureOneTimePriceExists(product, connectedAccountId, spaceId);

    const origin = getOrigin(space?.slug ?? "");
    const session = await createOneTimeCheckoutSession({
      customerId,
      priceId,
      amountCents: product.price_cents,
      connectedAccountId,
      spaceId,
      productId,
      productCategory: product.category,
      userId: user.id,
      successUrl: `${origin}/store/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/store`,
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

    const connectedAccountId = await verifyStripeReady(tenantId);

    // Ensure recurring price for addon
    const priceId = await ensureRecurringAddonPriceExists(
      product,
      connectedAccountId,
      spaceId,
    );

    // Add line item to existing subscription
    const subscription = await stripe.subscriptions.retrieve(
      member.stripe_subscription_id,
      { stripeAccount: connectedAccountId },
    );

    const existingItems = subscription.items.data.map((item) => ({
      id: item.id,
    }));

    await stripe.subscriptions.update(
      member.stripe_subscription_id,
      {
        items: [...existingItems, { price: priceId }],
        proration_behavior: "create_prorations",
      },
      { stripeAccount: connectedAccountId },
    );

    // For 24/7 access addon, update the member record
    if (product.slug.includes("24-7") || product.slug.includes("twenty-four-seven")) {
      await admin
        .from("members")
        .update({ has_twenty_four_seven: true, updated_at: new Date().toISOString() })
        .eq("id", member.id);
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
