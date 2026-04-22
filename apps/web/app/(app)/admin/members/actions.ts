"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createLogger } from "@cowork/shared";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrigin } from "@/lib/url";
import { provisionSubscription } from "@/lib/stripe/subscriptions";
import { grantMonthlyCredits } from "@/lib/credits/grant";
import type { Database } from "@cowork/db/types/database";
import {
  updateMemberSchema,
  addMemberNoteSchema,
  addMemberSchema,
  sendInviteSchema,
  sendBulkInvitesSchema,
  switchBillingSchema,
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

/**
 * Send an invite email via Supabase admin API.
 * Tries inviteUserByEmail first (works for new/unconfirmed users).
 * Falls back to signInWithOtp for already-confirmed users (re-invites).
 */
async function sendInviteEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  redirectTo: string,
): Promise<{ error: { message: string } | null }> {
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    { redirectTo },
  );
  if (!inviteError) return { error: null };

  // User likely already confirmed — fall back to magic link OTP
  const { error: otpError } = await admin.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  return { error: otpError };
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
  const admin = createAdminClient();
  const d = parsed.data;

  // Check if custom price changed on a Stripe-billed member
  // TODO: remove unknown casts after running `supabase gen types` with billing_mode migration
  const { data: currentRaw } = await admin
    .from("members")
    .select("custom_price_cents")
    .eq("id", memberId)
    .eq("space_id", spaceId)
    .single();
  const current = currentRaw as unknown as {
    billing_mode?: string;
    custom_price_cents: number | null;
  } | null;

  const priceChanged =
    current &&
    current.billing_mode === "stripe" &&
    d.customPriceCents !== current.custom_price_cents;

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

  if (priceChanged) {
    return {
      success: true as const,
      warning: "Custom price updated in the database. The active Stripe subscription was not changed — update it manually in the Stripe dashboard if needed.",
    };
  }

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
    try {
      const { data: space } = await admin
        .from("spaces")
        .select("tenant_id")
        .eq("id", spaceId)
        .single();

      if (!space?.tenant_id) throw new Error("Space has no tenant");

      await provisionSubscription({
        memberId: newMember.id,
        userId,
        planId: d.planId,
        spaceId,
        tenantId: space.tenant_id,
        customPriceCents: d.customPriceCents,
      });
    } catch (err) {
      logger.error("Failed to create Stripe subscription for admin-added member", {
        memberId: newMember.id,
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        success: true as const,
        warning: `Member added but Stripe subscription failed: ${err instanceof Error ? err.message : "Unknown error"}. You can switch to manual billing or retry.`,
      };
    }
  } else {
    // Manual billing — grant initial credits immediately
    try {
      // Credits valid until same day next month
      const now = new Date();
      const validUntil = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

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
    const { error: inviteError } = await sendInviteEmail(
      admin,
      d.email,
      `${origin}/auth/callback`,
    );

    if (inviteError) {
      logger.error("Invite email failed", { email: d.email, error: inviteError.message });
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

  const { error: inviteError } = await sendInviteEmail(
    admin,
    profile.email,
    `${origin}/auth/callback`,
  );

  if (inviteError) {
    return { success: false as const, error: inviteError.message };
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

    const { error: inviteError } = await sendInviteEmail(
      admin,
      email,
      `${origin}/auth/callback`,
    );

    if (inviteError) {
      createLogger({ component: "members/actions", spaceId }).warn("Bulk invite failed", { email, error: inviteError.message });
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

export async function switchToStripeBilling(input: unknown) {
  const parsed = switchBillingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, spaceId } = await getSpaceId();
  const admin = createAdminClient();
  const logger = createLogger({ component: "members/actions", spaceId });

  const { data: member } = await supabase
    .from("members")
    .select("id, user_id, plan_id, status, billing_mode, stripe_subscription_id, custom_price_cents")
    .eq("id", parsed.data.memberId)
    .eq("space_id", spaceId)
    .single();

  if (!member) {
    return { success: false as const, error: "Member not found" };
  }

  if ((member as Record<string, unknown>).billing_mode !== "manual") {
    return { success: false as const, error: "Member is not on manual billing." };
  }

  if (!member.plan_id) {
    return { success: false as const, error: "Assign a plan before switching to Stripe billing." };
  }

  if (member.stripe_subscription_id) {
    return { success: false as const, error: "Member already has a Stripe subscription." };
  }

  const { data: space } = await admin
    .from("spaces")
    .select("tenant_id")
    .eq("id", spaceId)
    .single();

  if (!space?.tenant_id) {
    return { success: false as const, error: "Space has no tenant" };
  }

  try {
    await provisionSubscription({
      memberId: member.id,
      userId: member.user_id,
      planId: member.plan_id,
      spaceId,
      tenantId: space.tenant_id,
      customPriceCents: member.custom_price_cents ?? null,
    });
  } catch (err) {
    logger.error("Failed to provision Stripe subscription", {
      memberId: member.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: false as const,
      error: `Stripe provisioning failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }

  revalidatePath("/admin/members");
  return { success: true as const };
}
