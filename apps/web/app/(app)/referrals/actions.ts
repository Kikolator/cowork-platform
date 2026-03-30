"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrCreateReferralCode } from "@/lib/referrals/codes";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const spaceId = user.app_metadata?.space_id as string | undefined;
  if (!spaceId) throw new Error("No space context");
  return { supabase, user, spaceId };
}

export async function getReferralData() {
  const { supabase, user, spaceId } = await getContext();

  // Check feature flag
  const { data: space } = await supabase
    .from("spaces")
    .select("features, slug")
    .eq("id", spaceId)
    .single();

  const featureFlags = (space?.features ?? {}) as Record<string, boolean>;
  if (!featureFlags.referrals) {
    return { enabled: false as const };
  }

  // Check if program is active
  const { data: program } = await supabase
    .from("referral_programs")
    .select("active, referred_discount_percent, referred_discount_months, referrer_reward_type, referrer_credit_minutes, referrer_discount_percent, referrer_discount_months")
    .eq("space_id", spaceId)
    .eq("active", true)
    .maybeSingle();

  if (!program) {
    return { enabled: false as const };
  }

  // Check if user is an active member
  const { data: member } = await supabase
    .from("members")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("space_id", spaceId)
    .maybeSingle();

  if (!member || member.status !== "active") {
    return { enabled: false as const };
  }

  // Get or create referral code
  const { code, expiresAt } = await getOrCreateReferralCode(
    member.id,
    user.id,
    spaceId,
  );

  // Load referral history
  const { data: referrals } = await supabase
    .from("referrals")
    .select("id, referred_email, status, referrer_rewarded, referrer_reward_type, completed_at, created_at")
    .eq("referrer_member_id", member.id)
    .order("created_at", { ascending: false });

  return {
    enabled: true as const,
    code,
    expiresAt,
    spaceSlug: space?.slug ?? "",
    program: {
      referredDiscountPercent: program.referred_discount_percent,
      referredDiscountMonths: program.referred_discount_months,
      referrerRewardType: program.referrer_reward_type,
      referrerCreditMinutes: program.referrer_credit_minutes,
      referrerDiscountPercent: program.referrer_discount_percent,
      referrerDiscountMonths: program.referrer_discount_months,
    },
    referrals: referrals ?? [],
  };
}
