import { NextResponse } from "next/server";
import { createLogger } from "@cowork/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { grantMonthlyCredits, expireRenewableCredits } from "@/lib/credits/grant";

const BATCH_SIZE = 500;

/** Calculate the next anniversary date from a join date. */
function getNextAnniversary(joinedAt: Date, today: Date): Date {
  const nextMonth = today.getMonth() + 1;
  const nextYear = today.getFullYear() + (nextMonth > 11 ? 1 : 0);
  const joinDay = joinedAt.getDate();
  // Clamp to last day of next month if join day exceeds it
  const lastDayOfNextMonth = new Date(nextYear, (nextMonth % 12) + 1, 0).getDate();
  const day = Math.min(joinDay, lastDayOfNextMonth);
  return new Date(nextYear, nextMonth % 12, day);
}

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

  // For months shorter than the join day (e.g., joined on 31st, current month
  // has 28 days), we renew on the last day of the month.
  const lastDayOfMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
  ).getDate();
  const isLastDay = dayOfMonth === lastDayOfMonth;

  let processed = 0;
  let errors = 0;
  let offset = 0;

  // Paginated query to handle large member counts across all tenants
  while (true) {
    const { data: members, error: queryError } = await admin
      .from("members")
      .select("id, user_id, plan_id, space_id, joined_at")
      .eq("billing_mode", "manual")
      .eq("status", "active")
      .order("id")
      .range(offset, offset + BATCH_SIZE - 1);

    if (queryError) {
      logger.error("Failed to query manual members", { error: queryError.message, offset });
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }

    if (!members || members.length === 0) break;

    for (const member of members) {
      if (!member.joined_at) continue;

      const joinDate = new Date(member.joined_at);
      const joinDay = joinDate.getDate();

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

        // Skip members with no plan (no credit config to grant)
        if (!member.plan_id) continue;

        // Grant new credits valid until next anniversary
        const validUntil = getNextAnniversary(joinDate, today);

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

    if (members.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  logger.info("Manual credit renewal completed", { processed, errors });
  return NextResponse.json({ processed, errors });
}
