import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

interface ReferralProgram {
  id: string;
  referrer_reward_type: string;
  referrer_credit_minutes: number | null;
  referrer_credit_resource_type_id: string | null;
  referrer_discount_percent: number | null;
  referrer_discount_months: number | null;
  referred_discount_percent: number;
  referred_discount_months: number;
  max_referrals_per_member: number | null;
  max_referrals_total: number | null;
}

type ValidationResult =
  | {
      valid: true;
      referralCodeId: string;
      referrerMemberId: string;
      referrerUserId: string;
      referrerName: string | null;
      program: ReferralProgram;
    }
  | { valid: false; error: string };

/**
 * Validate a referral code for use during checkout.
 * Checks: code exists & active, not expired, referrer still active,
 * limits not exceeded, not self-referral, never been a member, not already referred.
 */
export async function validateReferralCode(
  code: string,
  spaceId: string,
  referredEmail: string,
): Promise<ValidationResult> {
  const admin = createAdminClient();

  // 1. Check program exists and is active
  const { data: program } = await admin
    .from("referral_programs")
    .select(
      "id, referrer_reward_type, referrer_credit_minutes, referrer_credit_resource_type_id, referrer_discount_percent, referrer_discount_months, referred_discount_percent, referred_discount_months, max_referrals_per_member, max_referrals_total",
    )
    .eq("space_id", spaceId)
    .eq("active", true)
    .maybeSingle();

  if (!program) {
    return { valid: false, error: "Referral program is not active for this space" };
  }

  // 2. Check code exists, is active, and not expired
  const { data: referralCode } = await admin
    .from("referral_codes")
    .select("id, member_id, user_id, active, expires_at, uses_count")
    .eq("space_id", spaceId)
    .eq("code", code.toUpperCase().trim())
    .maybeSingle();

  if (!referralCode) {
    return { valid: false, error: "Invalid referral code" };
  }

  if (!referralCode.active) {
    return { valid: false, error: "This referral code is no longer active" };
  }

  if (referralCode.expires_at && new Date(referralCode.expires_at) < new Date()) {
    return { valid: false, error: "This referral code has expired" };
  }

  // 3. Check referrer is still an active member
  const { data: referrerMember } = await admin
    .from("members")
    .select("id, status, user_id")
    .eq("id", referralCode.member_id)
    .maybeSingle();

  if (!referrerMember || referrerMember.status !== "active") {
    return { valid: false, error: "The referrer is no longer an active member" };
  }

  // 4. Self-referral check — compare email
  const { data: referrerProfile } = await admin
    .from("shared_profiles")
    .select("email, full_name")
    .eq("id", referralCode.user_id)
    .maybeSingle();

  if (referrerProfile?.email?.toLowerCase() === referredEmail.toLowerCase()) {
    return { valid: false, error: "You cannot use your own referral code" };
  }

  // 5. Check referred email has NEVER been a member in this space (any status)
  const { data: profilesForEmail } = await admin
    .from("shared_profiles")
    .select("id")
    .eq("email", referredEmail.toLowerCase());

  const userIdsForEmail = profilesForEmail?.map((p) => p.id) ?? [];

  if (userIdsForEmail.length > 0) {
    const { count: memberCount } = await admin
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("space_id", spaceId)
      .in("user_id", userIdsForEmail);

    if (memberCount && memberCount > 0) {
      return { valid: false, error: "This email already has or had a membership at this space" };
    }
  }

  // 6. Check not already referred (pending or completed)
  const { count: referredCount } = await admin
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("space_id", spaceId)
    .eq("referred_email", referredEmail.toLowerCase())
    .in("status", ["pending", "completed"]);

  if (referredCount && referredCount > 0) {
    return { valid: false, error: "This email has already been referred" };
  }

  // 7. Per-member limit
  if (program.max_referrals_per_member !== null) {
    if (referralCode.uses_count >= program.max_referrals_per_member) {
      return { valid: false, error: "This member has reached their referral limit" };
    }
  }

  // 8. Space-wide limit
  if (program.max_referrals_total !== null) {
    const { count: totalCompleted } = await admin
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("space_id", spaceId)
      .eq("status", "completed");

    if (totalCompleted !== null && totalCompleted >= program.max_referrals_total) {
      return { valid: false, error: "The referral program has reached its limit" };
    }
  }

  return {
    valid: true,
    referralCodeId: referralCode.id,
    referrerMemberId: referralCode.member_id,
    referrerUserId: referralCode.user_id,
    referrerName: referrerProfile?.full_name ?? null,
    program,
  };
}
