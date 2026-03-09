import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@cowork/db";
import { getDateRange } from "./format";

// ── Types ──────────────────────────────────────────────────────────────

export interface DeskDayAvailability {
  available: number;
  total: number;
  closed: boolean;
  userBooked: boolean;
}

export interface TimeSlot {
  slotStart: string; // ISO timestamptz
  slotEnd: string;
  isAvailable: boolean;
}

type Supabase = SupabaseClient<Database>;

// ── Desk availability ──────────────────────────────────────────────────

/**
 * Get desk availability for a date range. Returns one entry per date.
 *
 * Batch-fetches all data sources (closures, bookings, passes, fixed desks,
 * user's own bookings) and merges into a per-date availability map.
 */
export async function getDeskAvailabilityRange(
  supabase: Supabase,
  spaceId: string,
  userId: string,
  startDate: string,
  endDate: string,
): Promise<Record<string, DeskDayAvailability>> {
  const dates = getDateRange(startDate, endDate);
  const result: Record<string, DeskDayAvailability> = {};

  // Batch-fetch: closures, total desks, bookings per day, user's own bookings, active passes
  const [
    { data: closures },
    { data: space },
    deskAvailResults,
    { data: userBookings },
  ] = await Promise.all([
    // Closures in date range
    supabase
      .from("space_closures")
      .select("date")
      .eq("space_id", spaceId)
      .gte("date", startDate)
      .lte("date", endDate),

    // Space timezone + business hours
    supabase
      .from("spaces")
      .select("timezone, business_hours")
      .eq("id", spaceId)
      .single(),

    // Get desk availability per date via RPC (batched)
    Promise.all(
      dates.map((date) =>
        supabase
          .rpc("get_desk_availability", { p_space_id: spaceId, p_date: date })
          .then(({ data }) => ({
            date,
            total: data?.[0]?.total_desks ?? 0,
            booked: data?.[0]?.booked_desks ?? 0,
            available: data?.[0]?.available_desks ?? 0,
          })),
      ),
    ),

    // User's own bookings in the range (desk type)
    supabase
      .from("bookings")
      .select("start_time, resource:resources!inner(resource_type:resource_types!inner(slug))")
      .eq("user_id", userId)
      .gte("start_time", startDate)
      .lte("start_time", endDate + "T23:59:59Z")
      .in("status", ["confirmed", "checked_in"]),
  ]);

  const closedDates = new Set((closures ?? []).map((c) => c.date));
  const timezone = space?.timezone ?? "Europe/Madrid";

  // Build a set of dates where the user already has a desk booking
  const userBookedDates = new Set<string>();
  for (const booking of userBookings ?? []) {
    const resource = booking.resource as unknown as {
      resource_type: { slug: string };
    };
    if (resource?.resource_type?.slug === "desk") {
      // Extract date in space timezone
      const d = new Date(booking.start_time);
      const localDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
      userBookedDates.add(localDate);
    }
  }

  // Build a map from RPC results
  const availMap = new Map(deskAvailResults.map((r) => [r.date, r]));

  // Merge into final result
  for (const date of dates) {
    const isClosed = closedDates.has(date);
    const avail = availMap.get(date);

    result[date] = {
      available: isClosed ? 0 : (avail?.available ?? 0),
      total: avail?.total ?? 0,
      closed: isClosed,
      userBooked: userBookedDates.has(date),
    };
  }

  return result;
}

// ── Room availability ──────────────────────────────────────────────────

/**
 * Get room time slots for a specific resource on a date.
 * Wraps the get_room_availability RPC.
 */
export async function getRoomSlots(
  supabase: Supabase,
  spaceId: string,
  resourceId: string,
  date: string,
): Promise<TimeSlot[]> {
  const { data, error } = await supabase.rpc("get_room_availability", {
    p_space_id: spaceId,
    p_resource_id: resourceId,
    p_date: date,
  });

  if (error || !data) return [];

  return (data as { slot_start: string; slot_end: string; is_available: boolean }[]).map(
    (row) => ({
      slotStart: row.slot_start,
      slotEnd: row.slot_end,
      isAvailable: row.is_available,
    }),
  );
}

// ── Closures ───────────────────────────────────────────────────────────

/**
 * Get space closures for a date range. Returns array of closed date strings.
 */
export async function getClosures(
  supabase: Supabase,
  spaceId: string,
  startDate: string,
  endDate: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("space_closures")
    .select("date")
    .eq("space_id", spaceId)
    .gte("date", startDate)
    .lte("date", endDate);

  return (data ?? []).map((c) => c.date);
}
