"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createLogger } from "@cowork/shared";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrigin } from "@/lib/url";
import { verifyStripeReady } from "@/lib/stripe/connect";
import { getEffectiveFeePercent } from "@/lib/stripe/fees";
import { findOrCreateCustomer, ensureStripePriceExists } from "@/lib/stripe/subscriptions";
import { getStripe } from "@/lib/stripe/client";
import { grantMonthlyCredits } from "@/lib/credits/grant";
import type { Database } from "@cowork/db/types/database";
import {
  updateMemberSchema,
  addMemberNoteSchema,
  addMemberSchema,
  sendInviteSchema,
  sendBulkInvitesSchema,
} from "./schemas";

type FiscalIdType = Database["public"]["Enums"]["fiscal_id_type"];

async function getSpaceId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const spaceId = user.app_metadata?.space_id as string | undefined;
  if (!spaceId) throw new Error("No space context");
  return { supabase, user, spaceId };
}

/** Coerce empty strings and sentinel values to null */
function emptyToNull(v: string | null | undefined): string | null {
  if (v == null || v === "" || v === "__none__") return null;
  return v;
}

export async function updateMember(memberId: string, input: unknown) {
  const parsed = updateMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, spaceId } = await getSpaceId();
  const d = parsed.data;

  const { error } = await supabase
    .from("members")
    .update({
      plan_id: d.planId,
      status: d.status,
      custom_price_cents: d.customPriceCents,
      fixed_desk_id: emptyToNull(d.fixedDeskId),
      has_twenty_four_seven: d.hasTwentyFourSeven,
      access_code: emptyToNull(d.accessCode),
      alarm_approved: d.alarmApproved,
      company: emptyToNull(d.company),
      role_title: emptyToNull(d.roleTitle),
      billing_entity_type: d.billingEntityType,
      fiscal_id_type: emptyToNull(d.fiscalIdType) as FiscalIdType | null,
      fiscal_id: emptyToNull(d.fiscalId),
      billing_company_name: emptyToNull(d.billingCompanyName),
      billing_company_tax_id_type: emptyToNull(d.billingCompanyTaxIdType) as FiscalIdType | null,
      billing_company_tax_id: emptyToNull(d.billingCompanyTaxId),
      billing_address_line1: emptyToNull(d.billingAddressLine1),
      billing_address_line2: emptyToNull(d.billingAddressLine2),
      billing_city: emptyToNull(d.billingCity),
      billing_postal_code: emptyToNull(d.billingPostalCode),
      billing_state_province: emptyToNull(d.billingStateProvince),
      billing_country: emptyToNull(d.billingCountry),
    })
    .eq("id", memberId)
    .eq("space_id", spaceId);

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidatePath("/admin/members");
  return { success: true as const };
}

export async function addMemberNote(input: unknown) {
  const parsed = addMemberNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, user, spaceId } = await getSpaceId();
  const d = parsed.data;

  const { error } = await supabase.from("member_notes").insert({
    space_id: spaceId,
    member_id: d.memberId,
    author_id: user.id,
    content: d.content,
    category: d.category,
  });

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidatePath("/admin/members");
  return { success: true as const };
}

export async function addMember(input: unknown) {
  const parsed = addMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, spaceId } = await getSpaceId();
  const admin = createAdminClient();
  const d = parsed.data;

  // 1. Create or find auth user
  let userId: string;
  const { data: authUser, error: authError } =
    await admin.auth.admin.createUser({
      email: d.email,
      email_confirm: false,
    });

  if (authError) {
    // User likely already exists — look up via shared_profiles
    const { data: profile, error: profileLookupError } = await admin
      .from("shared_profiles")
      .select("id")
      .eq("email", d.email.toLowerCase())
      .maybeSingle();

    if (profileLookupError) {
      console.error("[addMember] profile lookup failed", { email: d.email, error: profileLookupError.message });
      return { success: false as const, error: "Failed to look up user profile. Please try again." };
    }

    if (profile) {
      userId = profile.id;
    } else {
      // Profile missing for existing auth user — resolve via auth.users
      const { data: authUserId, error: rpcError } = await admin.rpc(
        "get_auth_user_id_by_email",
        { p_email: d.email.toLowerCase() },
      );

      if (rpcError || !authUserId) {
        console.error("[addMember] RPC get_auth_user_id_by_email failed", { email: d.email, rpcError: rpcError?.message });
        return { success: false as const, error: `Cannot find user for ${d.email}. Please try again.` };
      }

      userId = authUserId;

      // Create the missing shared_profiles row
      const { error: profileInsertError } = await admin.from("shared_profiles").insert({
        id: userId,
        email: d.email.toLowerCase(),
      });

      if (profileInsertError) {
        console.error("[addMember] failed to create missing profile", { userId, error: profileInsertError.message });
        return { success: false as const, error: "Failed to create user profile. Please try again." };
      }
    }
  } else {
    userId = authUser.user.id;
  }

  // 2. Update shared_profiles with name/phone if provided
  const profileUpdates: Record<string, string> = {};
  if (d.fullName) profileUpdates.full_name = d.fullName;
  if (d.phone) profileUpdates.phone = d.phone;
  if (Object.keys(profileUpdates).length > 0) {
    const { error: profileUpdateError } = await admin.from("shared_profiles").update(profileUpdates).eq("id", userId);
    if (profileUpdateError) {
      console.error("[addMember] profile update failed", { userId, error: profileUpdateError.message });
    }
  }

  // 3. Ensure space_users entry exists (atomic, won't downgrade existing roles)
  await admin.from("space_users").upsert(
    { user_id: userId, space_id: spaceId, role: "member" },
    { onConflict: "user_id,space_id", ignoreDuplicates: true },
  );

  // 4. Guard: check for existing member in this space
  const { data: existingMember } = await admin
    .from("members")
    .select("id")
    .eq("space_id", spaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingMember) {
    return { success: false as const, error: "This person is already a member of this space" };
  }

  // 4b. Check space capacity for the selected plan
  const { data: capacity, error: capacityError } = await admin.rpc("check_space_capacity", {
    p_space_id: spaceId,
    p_plan_id: d.planId,
  });
  if (capacityError) {
    console.error("[addMember] capacity check failed", { spaceId, planId: d.planId, error: capacityError.message });
    return { success: false as const, error: "Failed to check space capacity. Please try again." };
  }
  if (capacity && typeof capacity === "object" && "has_capacity" in capacity && !capacity.has_capacity) {
    return { success: false as const, error: "No desk capacity available for this plan. Consider adding more desks or choosing a different plan." };
  }

  // 5. Insert member record
  const { data: newMember, error: insertError } = await supabase
    .from("members")
    .insert({
      space_id: spaceId,
      user_id: userId,
      plan_id: d.planId,
      status: "active",
      billing_mode: d.billingMode,
      custom_price_cents: d.customPriceCents,
      company: d.company || null,
    })
    .select("id")
    .single();

  if (insertError || !newMember) {
    return { success: false as const, error: insertError?.message ?? "Failed to create member" };
  }

  const logger = createLogger({ component: "members/actions", spaceId });

  // 6. Handle billing mode
  if (d.billingMode === "stripe") {
    // Create Stripe subscription with send_invoice collection method
    try {
      const { data: space } = await admin
        .from("spaces")
        .select("tenant_id")
        .eq("id", spaceId)
        .single();

      if (!space?.tenant_id) throw new Error("Space has no tenant");

      const { stripeAccountId, platformPlan, platformFeePercent } =
        await verifyStripeReady(space.tenant_id);
      const feePercent = getEffectiveFeePercent(platformPlan, platformFeePercent);

      // Get member's email for customer creation
      const { data: profile } = await admin
        .from("shared_profiles")
        .select("email, full_name")
        .eq("id", userId)
        .single();

      const customerId = await findOrCreateCustomer({
        email: profile?.email ?? d.email,
        name: profile?.full_name ?? d.fullName ?? null,
        existingCustomerId: null,
        connectedAccountId: stripeAccountId,
        spaceId,
        userId,
      });

      // Get plan for price creation
      const { data: plan } = await admin
        .from("plans")
        .select("id, name, price_cents, currency, stripe_price_id, stripe_product_id")
        .eq("id", d.planId)
        .single();

      if (!plan) throw new Error("Plan not found");

      // Use custom price or plan price
      const effectivePrice = d.customPriceCents ?? plan.price_cents;

      let priceId: string;
      if (d.customPriceCents != null && d.customPriceCents !== plan.price_cents) {
        // Create a custom Stripe price for this member
        const productId = plan.stripe_product_id
          ?? (await ensureStripePriceExists(plan, stripeAccountId, spaceId),
             (await admin.from("plans").select("stripe_product_id").eq("id", plan.id).single()).data?.stripe_product_id);

        if (!productId) throw new Error("Could not resolve Stripe product");

        const customPrice = await getStripe().prices.create(
          {
            product: productId,
            unit_amount: effectivePrice,
            currency: plan.currency,
            recurring: { interval: "month" },
            metadata: { space_id: spaceId, plan_id: plan.id, custom_for_member: newMember.id },
          },
          { stripeAccount: stripeAccountId },
        );
        priceId = customPrice.id;
      } else {
        priceId = await ensureStripePriceExists(plan, stripeAccountId, spaceId);
      }

      // Create subscription with send_invoice (no immediate payment required)
      const subscription = await getStripe().subscriptions.create(
        {
          customer: customerId,
          items: [{ price: priceId }],
          collection_method: "send_invoice",
          days_until_due: 7,
          application_fee_percent: feePercent,
          metadata: {
            space_id: spaceId,
            plan_id: d.planId,
            user_id: userId,
          },
        },
        { stripeAccount: stripeAccountId },
      );

      // Update member with Stripe fields
      await admin
        .from("members")
        .update({
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
        })
        .eq("id", newMember.id);
    } catch (err) {
      logger.error("Failed to create Stripe subscription for admin-added member", {
        memberId: newMember.id,
        error: err instanceof Error ? err.message : String(err),
      });
      // Member is created but without Stripe — admin can retry or switch to manual
      return {
        success: true as const,
        warning: `Member added but Stripe subscription failed: ${err instanceof Error ? err.message : "Unknown error"}. You can switch to manual billing or retry.`,
      };
    }
  } else {
    // Manual billing — grant initial credits immediately
    try {
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 30);

      await grantMonthlyCredits({
        spaceId,
        userId,
        planId: d.planId,
        stripeInvoiceId: `manual_initial_${newMember.id}`,
        validUntil,
      });
    } catch (err) {
      logger.error("Failed to grant initial credits for manual member", {
        memberId: newMember.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 7. Optionally send invite
  let inviteFailed = false;
  if (d.sendInvite) {
    const headersList = await headers();
    const origin = getOrigin(headersList);
    const { error: otpError } = await admin.auth.signInWithOtp({
      email: d.email,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });

    if (otpError) {
      logger.error("Invite OTP failed", { email: d.email, error: otpError.message });
      inviteFailed = true;
    } else {
      await supabase
        .from("members")
        .update({ invited_at: new Date().toISOString() })
        .eq("id", newMember.id)
        .eq("space_id", spaceId);
    }
  }

  revalidatePath("/admin/members");

  if (inviteFailed) {
    return { success: true as const, warning: "Member added but the invite email failed to send. You can retry from the member detail page." };
  }
  return { success: true as const };
}

export async function sendMemberInvite(input: unknown) {
  const parsed = sendInviteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, spaceId } = await getSpaceId();
  const admin = createAdminClient();

  const { data: member } = await supabase
    .from("members")
    .select("id, user_id")
    .eq("id", parsed.data.memberId)
    .eq("space_id", spaceId)
    .single();

  if (!member) {
    return { success: false as const, error: "Member not found" };
  }

  const { data: profile } = await admin
    .from("shared_profiles")
    .select("email")
    .eq("id", member.user_id)
    .single();

  if (!profile) {
    return { success: false as const, error: "Profile not found" };
  }

  const headersList = await headers();
  const origin = getOrigin(headersList);

  const { error: otpError } = await admin.auth.signInWithOtp({
    email: profile.email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (otpError) {
    return { success: false as const, error: otpError.message };
  }

  await supabase
    .from("members")
    .update({ invited_at: new Date().toISOString() })
    .eq("id", member.id)
    .eq("space_id", spaceId);

  revalidatePath("/admin/members");
  return { success: true as const };
}

export async function sendBulkInvites(input: unknown) {
  const parsed = sendBulkInvitesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, spaceId } = await getSpaceId();
  const admin = createAdminClient();

  const { data: members } = await supabase
    .from("members")
    .select("id, user_id")
    .in("id", parsed.data.memberIds)
    .eq("space_id", spaceId);

  if (!members || members.length === 0) {
    return { success: false as const, error: "No members found" };
  }

  const userIds = members.map((m) => m.user_id);
  const { data: profiles } = await admin
    .from("shared_profiles")
    .select("id, email")
    .in("id", userIds);

  const emailByUserId = new Map(
    (profiles ?? []).map((p) => [p.id, p.email]),
  );

  const headersList = await headers();
  const origin = getOrigin(headersList);
  let sent = 0;
  let failed = 0;

  for (const member of members) {
    const email = emailByUserId.get(member.user_id);
    if (!email) {
      failed++;
      continue;
    }

    const { error: otpError } = await admin.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });

    if (otpError) {
      createLogger({ component: "members/actions", spaceId }).warn("Bulk invite OTP failed", { email, error: otpError.message });
      failed++;
      continue;
    }

    const { error: updateError } = await supabase
      .from("members")
      .update({ invited_at: new Date().toISOString() })
      .eq("id", member.id)
      .eq("space_id", spaceId);

    if (updateError) {
      createLogger({ component: "members/actions", spaceId }).warn("Failed to update invited_at", { memberId: member.id, error: updateError.message });
    }

    sent++;
  }

  revalidatePath("/admin/members");
  return { success: true as const, sent, failed };
}
