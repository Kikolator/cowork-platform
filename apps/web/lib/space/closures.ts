import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getBusinessHoursForDate, type BusinessHours } from "@/lib/booking/format";

/**
 * Check if a space is closed on a given date.
 * Checks both business_hours (weekday config) and space_closures table.
 */
export async function isSpaceClosedOnDate(
  admin: SupabaseClient,
  spaceId: string,
  date: string,
  businessHours: BusinessHours,
  timezone: string,
): Promise<{ closed: boolean; reason?: string }> {
  // Check business hours first (weekends etc.)
  const hours = getBusinessHoursForDate(businessHours, date, timezone);
  if (!hours) {
    return { closed: true, reason: "Space is closed on this day" };
  }

  // Check space_closures table
  const { data: closure } = await admin
    .from("space_closures")
    .select("reason, all_day")
    .eq("space_id", spaceId)
    .eq("date", date)
    .eq("all_day", true)
    .maybeSingle();

  if (closure) {
    return {
      closed: true,
      reason: closure.reason ? `Closed: ${closure.reason}` : "Space is closed on this day",
    };
  }

  return { closed: false };
}

/**
 * Calculate end date for a consecutive pass, skipping weekends and closures.
 * Returns the end date as YYYY-MM-DD.
 */
export async function calculatePassEndDate(
  admin: SupabaseClient,
  spaceId: string,
  startDate: string,
  durationDays: number,
  businessHours: BusinessHours,
  timezone: string,
): Promise<string> {
  if (durationDays <= 1) return startDate;

  // Fetch all closures from start_date forward (generous range)
  const maxEndDate = new Date(startDate + "T12:00:00Z");
  maxEndDate.setUTCDate(maxEndDate.getUTCDate() + durationDays * 3); // generous buffer
  const maxEndStr = maxEndDate.toISOString().split("T")[0]!;

  const { data: closures } = await admin
    .from("space_closures")
    .select("date")
    .eq("space_id", spaceId)
    .eq("all_day", true)
    .gte("date", startDate)
    .lte("date", maxEndStr);

  const closureDates = new Set((closures ?? []).map((c) => c.date));

  const cursor = new Date(startDate + "T12:00:00Z");
  let daysAssigned = 1; // start date counts as day 1

  while (daysAssigned < durationDays) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const dateStr = cursor.toISOString().split("T")[0]!;

    // Skip weekends
    const dayOfWeek = cursor.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    // Skip closures
    if (closureDates.has(dateStr)) continue;

    // Skip days where business hours are null
    const hours = getBusinessHoursForDate(businessHours, dateStr, timezone);
    if (!hours) continue;

    daysAssigned++;
  }

  return cursor.toISOString().split("T")[0]!;
}
