"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrigin } from "@/lib/url";
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
    const { data: profile } = await admin
      .from("shared_profiles")
      .select("id")
      .eq("email", d.email.toLowerCase())
      .maybeSingle();

    if (!profile) {
      return { success: false as const, error: `Cannot create user for ${d.email}: ${authError.message}` };
    }
    userId = profile.id;
  } else {
    userId = authUser.user.id;
  }

  // 2. Update shared_profiles with name/phone if provided
  const profileUpdates: Record<string, string> = {};
  if (d.fullName) profileUpdates.full_name = d.fullName;
  if (d.phone) profileUpdates.phone = d.phone;
  if (Object.keys(profileUpdates).length > 0) {
    await admin.from("shared_profiles").update(profileUpdates).eq("id", userId);
  }

  // 3. Ensure space_users entry exists
  await admin.from("space_users").upsert(
    { user_id: userId, space_id: spaceId, role: "member" },
    { onConflict: "user_id,space_id" },
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
  const { data: capacity } = await admin.rpc("check_space_capacity", {
    p_space_id: spaceId,
    p_plan_id: d.planId,
  });
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
      company: d.company || null,
    })
    .select("id")
    .single();

  if (insertError || !newMember) {
    return { success: false as const, error: insertError?.message ?? "Failed to create member" };
  }

  // 6. Optionally send invite
  if (d.sendInvite) {
    const headersList = await headers();
    const origin = getOrigin(headersList);
    await admin.auth.signInWithOtp({
      email: d.email,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
    await supabase
      .from("members")
      .update({ invited_at: new Date().toISOString() })
      .eq("id", newMember.id)
      .eq("space_id", spaceId);
  }

  revalidatePath("/admin/members");
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
      failed++;
      continue;
    }

    await supabase
      .from("members")
      .update({ invited_at: new Date().toISOString() })
      .eq("id", member.id)
      .eq("space_id", spaceId);

    sent++;
  }

  revalidatePath("/admin/members");
  return { success: true as const, sent, failed };
}
