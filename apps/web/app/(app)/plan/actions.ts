"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSpaceUrlFromHeaders } from "@/lib/url";
import { verifyStripeReady } from "@/lib/stripe/connect";
import { getEffectiveFeePercent } from "@/lib/stripe/fees";
import {
  ensureStripePriceExists,
  createCheckoutSession,
  findOrCreateCustomer,
  updateSubscriptionPrice,
  cancelSubscriptionAtPeriodEnd,
  resumeSubscriptionCancellation,
} from "@/lib/stripe/subscriptions";
import { validateReferralCode } from "@/lib/referrals/validate";
import { createReferralCoupon } from "@/lib/stripe/coupons";
import { ensureStripeTaxRateExists } from "@/lib/stripe/tax-rates";

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

interface FiscalData {
  billingEntityType: string;
  fiscalIdType: string;
  fiscalId: string;
  companyName?: string;
  companyTaxId?: string;
  companyTaxIdType?: string;
  billingAddressLine1?: string;
  billingAddressLine2?: string;
  billingCity?: string;
  billingPostalCode?: string;
  billingCountry?: string;
}

export async function subscribeToPlan(
  planId: string,
  fiscalData?: FiscalData,
  referralCode?: string,
): Promise<
  | { success: true; url: string }
  | { success: false; error: string }
> {
  try {
    const { user, spaceId, tenantId } = await getSpaceContext();

    // Check existing membership
    const admin = createAdminClient();
    const { data: existingMember } = await admin
      .from("members")
      .select("id, status, stripe_customer_id, fiscal_id")
      .eq("user_id", user.id)
      .eq("space_id", spaceId)
      .maybeSingle();

    if (existingMember && (existingMember.status === "active" || existingMember.status === "paused")) {
      return { success: false, error: "You already have an active subscription" };
    }

    // Fetch plan
    const { data: plan } = await admin
      .from("plans")
      .select("id, name, price_cents, currency, stripe_price_id, stripe_product_id, active, space_id, desk_weight")
      .eq("id", planId)
      .eq("space_id", spaceId)
      .single();

    if (!plan) return { success: false, error: "Plan not found" };
    if (!plan.active) return { success: false, error: "This plan is no longer available" };

    // Check space capacity
    if (plan.desk_weight > 0) {
      const { data: capacity } = await admin.rpc("check_space_capacity", {
        p_space_id: spaceId,
        p_plan_id: planId,
      });
      if (capacity && typeof capacity === "object" && "has_capacity" in capacity && !capacity.has_capacity) {
        return { success: false, error: "This plan is currently sold out. No desk capacity available." };
      }
    }

    // Check fiscal ID requirement + tax config
    const { data: space } = await admin
      .from("spaces")
      .select("require_fiscal_id")
      .eq("id", spaceId)
      .single();

    // Fetch tax config
    const { data: taxConfig } = await admin
      .from("spaces")
      .select("default_iva_rate, tax_inclusive")
      .eq("id", spaceId)
      .single();
    const defaultIvaRate = taxConfig?.default_iva_rate ?? 21;
    const taxInclusive = taxConfig?.tax_inclusive ?? true;

    if (space?.require_fiscal_id) {
      const hasFiscalId = existingMember?.fiscal_id || fiscalData?.fiscalId;

      if (!hasFiscalId) {
        return { success: false, error: "fiscal_id_required" };
      }

      // If fiscal data was provided inline, save it to the member record
      if (fiscalData && !existingMember?.fiscal_id) {
        const fiscalFields = {
          billing_entity_type: fiscalData.billingEntityType,
          fiscal_id_type: fiscalData.fiscalIdType as "nif" | "nie" | "passport" | "cif" | "eu_vat" | "foreign_tax_id" | "other",
          fiscal_id: fiscalData.fiscalId,
          billing_company_name: fiscalData.companyName ?? null,
          billing_company_tax_id: fiscalData.companyTaxId ?? null,
          billing_company_tax_id_type: fiscalData.companyTaxIdType
            ? (fiscalData.companyTaxIdType as "nif" | "nie" | "passport" | "cif" | "eu_vat" | "foreign_tax_id" | "other")
            : null,
          billing_address_line1: fiscalData.billingAddressLine1 ?? null,
          billing_address_line2: fiscalData.billingAddressLine2 ?? null,
          billing_city: fiscalData.billingCity ?? null,
          billing_postal_code: fiscalData.billingPostalCode ?? null,
          billing_country: fiscalData.billingCountry ?? null,
        };

        if (existingMember) {
          const { error: fiscalError } = await admin.from("members").update(fiscalFields).eq("id", existingMember.id);
          if (fiscalError) {
            return { success: false as const, error: `Failed to update billing info: ${fiscalError.message}` };
          }
        }
        // For new members, the checkout webhook will create the member record.
        // We pass fiscal data through Stripe metadata to apply it after checkout.
      }
    }

    // Verify Stripe is ready
    const { stripeAccountId, platformPlan, platformFeePercent } =
      await verifyStripeReady(tenantId);
    const feePercent = getEffectiveFeePercent(platformPlan, platformFeePercent);

    // Ensure Stripe price exists
    const priceId = await ensureStripePriceExists(plan, stripeAccountId, spaceId);

    // Find or create customer
    const customerId = await findOrCreateCustomer({
      email: user.email ?? "",
      name: user.user_metadata?.full_name ?? null,
      existingCustomerId: existingMember?.stripe_customer_id ?? null,
      connectedAccountId: stripeAccountId,
      spaceId,
      userId: user.id,
    });

    // Save customer ID if this is a churned resubscription
    if (existingMember && !existingMember.stripe_customer_id) {
      await admin
        .from("members")
        .update({ stripe_customer_id: customerId })
        .eq("id", existingMember.id);
    }

    // Validate referral code and create coupon if applicable
    let couponId: string | undefined;
    let referralId: string | undefined;

    if (referralCode) {
      const validation = await validateReferralCode(
        referralCode,
        spaceId,
        user.email ?? "",
      );

      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Create pending referral record
      const { data: referral, error: referralError } = await admin
        .from("referrals")
        .insert({
          space_id: spaceId,
          referral_code_id: validation.referralCodeId,
          referrer_member_id: validation.referrerMemberId,
          referrer_user_id: validation.referrerUserId,
          referred_email: user.email?.toLowerCase() ?? "",
          referred_user_id: user.id,
          status: "pending",
        })
        .select("id")
        .single();

      if (referralError || !referral) {
        return { success: false, error: "Failed to process referral" };
      }

      referralId = referral.id;

      // Create Stripe coupon for referred member discount
      if (validation.program.referred_discount_percent > 0) {
        couponId = await createReferralCoupon({
          percentOff: validation.program.referred_discount_percent,
          durationMonths: validation.program.referred_discount_months,
          connectedAccountId: stripeAccountId,
          spaceId,
          referralId: referral.id,
        });

        // Store coupon ID on the referral record
        await admin
          .from("referrals")
          .update({ stripe_coupon_id: couponId })
          .eq("id", referral.id);
      }
    }

    // Resolve Stripe tax rate
    const taxRateId = await ensureStripeTaxRateExists({
      spaceId,
      connectedAccountId: stripeAccountId,
      ivaRate: defaultIvaRate,
      inclusive: taxInclusive,
    }) ?? undefined;

    // Build URLs
    const h = await headers();
    const { data: spaceData } = await admin
      .from("spaces")
      .select("slug")
      .eq("id", spaceId)
      .single();
    const slug = spaceData?.slug ?? "";
    const successUrl = buildSpaceUrlFromHeaders(slug, "/plan/success?session_id={CHECKOUT_SESSION_ID}", h);
    const cancelUrl = buildSpaceUrlFromHeaders(slug, "/plan", h);

    // Create checkout session
    const session = await createCheckoutSession({
      customerId,
      priceId,
      connectedAccountId: stripeAccountId,
      feePercent,
      spaceId,
      planId,
      userId: user.id,
      successUrl,
      cancelUrl,
      couponId,
      referralId,
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

export async function changePlan(newPlanId: string): Promise<
  | { success: true; message: string }
  | { success: false; error: string }
> {
  try {
    const { user, spaceId, tenantId } = await getSpaceContext();
    const admin = createAdminClient();

    // Fetch current member
    const { data: member } = await admin
      .from("members")
      .select("id, plan_id, stripe_subscription_id, status")
      .eq("user_id", user.id)
      .eq("space_id", spaceId)
      .single();

    if (!member) return { success: false, error: "No active membership found" };
    if (member.status !== "active" && member.status !== "cancelling") {
      return { success: false, error: "Subscription must be active to change plans" };
    }
    if (!member.stripe_subscription_id) {
      return { success: false, error: "No subscription found" };
    }
    if (member.plan_id === newPlanId) {
      return { success: false, error: "You are already on this plan" };
    }

    // Fetch new plan
    const { data: newPlan } = await admin
      .from("plans")
      .select("id, name, price_cents, currency, stripe_price_id, stripe_product_id, active, space_id, desk_weight")
      .eq("id", newPlanId)
      .eq("space_id", spaceId)
      .single();

    if (!newPlan) return { success: false, error: "Plan not found" };
    if (!newPlan.active) return { success: false, error: "This plan is no longer available" };

    // Check space capacity for the new plan (excluding current member's weight)
    if (newPlan.desk_weight > 0) {
      const { data: capacity } = await admin.rpc("check_space_capacity", {
        p_space_id: spaceId,
        p_plan_id: newPlanId,
        p_exclude_member_id: member.id,
      });
      if (capacity && typeof capacity === "object" && "has_capacity" in capacity && !capacity.has_capacity) {
        return { success: false, error: "Cannot switch to this plan. No desk capacity available." };
      }
    }

    const { stripeAccountId } = await verifyStripeReady(tenantId);
    const priceId = await ensureStripePriceExists(newPlan, stripeAccountId, spaceId);

    await updateSubscriptionPrice({
      subscriptionId: member.stripe_subscription_id,
      newPriceId: priceId,
      newPlanId,
      connectedAccountId: stripeAccountId,
    });

    revalidatePath("/plan");
    return { success: true, message: "Plan change processing..." };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Something went wrong",
    };
  }
}

export async function cancelSubscription(): Promise<
  | { success: true; periodEnd: number }
  | { success: false; error: string }
> {
  try {
    const { user, spaceId, tenantId } = await getSpaceContext();
    const admin = createAdminClient();

    const { data: member } = await admin
      .from("members")
      .select("id, stripe_subscription_id, status")
      .eq("user_id", user.id)
      .eq("space_id", spaceId)
      .single();

    if (!member) return { success: false, error: "No membership found" };
    if (member.status !== "active" && member.status !== "past_due") {
      return { success: false, error: "Subscription is not active" };
    }
    if (!member.stripe_subscription_id) {
      return { success: false, error: "No subscription found" };
    }

    const { stripeAccountId } = await verifyStripeReady(tenantId);
    const subscription = await cancelSubscriptionAtPeriodEnd(
      member.stripe_subscription_id,
      stripeAccountId,
    );

    await admin
      .from("members")
      .update({
        status: "cancelling",
        cancel_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", member.id);

    // In the new Stripe API, period end is on subscription items
    const periodEnd =
      subscription.items.data[0]?.current_period_end ?? subscription.cancel_at ?? 0;

    revalidatePath("/plan");
    return {
      success: true,
      periodEnd,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Something went wrong",
    };
  }
}

export async function resumeSubscription(): Promise<
  | { success: true }
  | { success: false; error: string }
> {
  try {
    const { user, spaceId, tenantId } = await getSpaceContext();
    const admin = createAdminClient();

    const { data: member } = await admin
      .from("members")
      .select("id, stripe_subscription_id, status")
      .eq("user_id", user.id)
      .eq("space_id", spaceId)
      .single();

    if (!member) return { success: false, error: "No membership found" };
    if (member.status !== "cancelling") {
      return { success: false, error: "Subscription is not scheduled for cancellation" };
    }
    if (!member.stripe_subscription_id) {
      return { success: false, error: "No subscription found" };
    }

    const { stripeAccountId } = await verifyStripeReady(tenantId);
    await resumeSubscriptionCancellation(
      member.stripe_subscription_id,
      stripeAccountId,
    );

    await admin
      .from("members")
      .update({
        status: "active",
        cancel_requested_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", member.id);

    revalidatePath("/plan");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Something went wrong",
    };
  }
}

