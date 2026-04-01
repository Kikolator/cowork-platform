import { NextResponse } from "next/server";
import { createLogger } from "@cowork/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { grantMonthlyCredits, expireRenewableCredits } from "@/lib/credits/grant";

/**
 * Daily cron: renew credits for manual-billing members on their monthly anniversary.
 * Runs every day at midnight UTC. Configured in vercel.json.
 */
export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logger = createLogger({ component: "cron/renew-credits" });
  const admin = createAdminClient();
  const today = new Date();
  const dayOfMonth = today.getDate();

  // Find manual-billing active members whose joined_at day matches today.
  // For months shorter than the join day (e.g., joined on 31st, current month
  // has 28 days), we renew on the last day of the month.
  const lastDayOfMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
  ).getDate();
  const isLastDay = dayOfMonth === lastDayOfMonth;

  // Query members: day of month matches, OR it's the last day and their
  // join day exceeds this month's length
  const { data: members, error: queryError } = await admin
    .from("members")
    .select("id, user_id, plan_id, space_id, joined_at")
    .eq("billing_mode", "manual")
    .eq("status", "active");

  if (queryError) {
    logger.error("Failed to query manual members", { error: queryError.message });
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  if (!members || members.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  let processed = 0;
  let errors = 0;

  for (const member of members) {
    if (!member.joined_at) continue;

    const joinDay = new Date(member.joined_at).getDate();

    // Check if today is this member's renewal day
    const isDueToday =
      joinDay === dayOfMonth ||
      (isLastDay && joinDay > lastDayOfMonth);

    if (!isDueToday) continue;

    try {
      // Expire previous month's credits
      await expireRenewableCredits({
        spaceId: member.space_id,
        userId: member.user_id,
      });

      // Grant new credits
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 30);

      await grantMonthlyCredits({
        spaceId: member.space_id,
        userId: member.user_id,
        planId: member.plan_id,
        stripeInvoiceId: `manual_renewal_${member.id}_${today.toISOString().slice(0, 10)}`,
        validUntil,
      });

      processed++;
    } catch (err) {
      errors++;
      logger.error("Failed to renew credits for manual member", {
        memberId: member.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info("Manual credit renewal completed", { processed, errors });
  return NextResponse.json({ processed, errors });
}
