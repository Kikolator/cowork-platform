"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { referralProgramSchema } from "./schemas";

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

export async function upsertReferralProgram(input: unknown) {
  const parsed = referralProgramSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { supabase, spaceId } = await getSpaceId();
  const d = parsed.data;

  const { error } = await supabase.from("referral_programs").upsert(
    {
      space_id: spaceId,
      active: d.active,
      referrer_reward_type: d.referrerRewardType,
      referrer_credit_minutes: d.referrerCreditMinutes,
      referrer_credit_resource_type_id: d.referrerCreditResourceTypeId,
      referrer_discount_percent: d.referrerDiscountPercent,
      referrer_discount_months: d.referrerDiscountMonths,
      referred_discount_percent: d.referredDiscountPercent,
      referred_discount_months: d.referredDiscountMonths,
      max_referrals_per_member: d.maxReferralsPerMember,
      max_referrals_total: d.maxReferralsTotal,
      code_expiry_days: d.codeExpiryDays,
    },
    { onConflict: "space_id" },
  );

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidatePath("/admin/referrals");
  return { success: true as const };
}

export async function cancelReferral(referralId: string) {
  const parsed = z.string().uuid().safeParse(referralId);
  if (!parsed.success) {
    return { success: false as const, error: "Invalid referral ID" };
  }

  const { supabase } = await getSpaceId();

  const { error } = await supabase
    .from("referrals")
    .update({ status: "cancelled" })
    .eq("id", referralId)
    .eq("status", "pending");

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidatePath("/admin/referrals");
  return { success: true as const };
}
