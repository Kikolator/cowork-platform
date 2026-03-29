import "server-only";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const CODE_LENGTH = 8;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I/O/0/1 to avoid confusion

/**
 * Generate a random referral code.
 * Format: 8-character uppercase alphanumeric (e.g., "ALEX8K3M").
 */
export function generateReferralCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
  }
  return code;
}

/**
 * Get or create a referral code for a member. Idempotent — returns existing
 * code if one already exists. Retries on code collision (UNIQUE constraint).
 */
export async function getOrCreateReferralCode(
  memberId: string,
  userId: string,
  spaceId: string,
): Promise<{ code: string; expiresAt: string | null }> {
  const admin = createAdminClient();

  // Check for existing code
  const { data: existing } = await admin
    .from("referral_codes")
    .select("code, expires_at")
    .eq("space_id", spaceId)
    .eq("member_id", memberId)
    .maybeSingle();

  if (existing) {
    return { code: existing.code, expiresAt: existing.expires_at };
  }

  // Load program config for expiry
  const { data: program } = await admin
    .from("referral_programs")
    .select("code_expiry_days")
    .eq("space_id", spaceId)
    .eq("active", true)
    .maybeSingle();

  const expiresAt = program?.code_expiry_days
    ? new Date(Date.now() + program.code_expiry_days * 24 * 60 * 60 * 1000).toISOString()
    : null;

  // Try up to 3 times in case of code collision
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateReferralCode();

    const { data, error } = await admin
      .from("referral_codes")
      .insert({
        space_id: spaceId,
        member_id: memberId,
        user_id: userId,
        code,
        expires_at: expiresAt,
      })
      .select("code, expires_at")
      .single();

    if (data) {
      return { code: data.code, expiresAt: data.expires_at };
    }

    // If it's not a unique violation, throw
    if (error && !error.message.includes("unique")) {
      throw new Error(`Failed to create referral code: ${error.message}`);
    }
  }

  throw new Error("Failed to generate unique referral code after 3 attempts");
}
