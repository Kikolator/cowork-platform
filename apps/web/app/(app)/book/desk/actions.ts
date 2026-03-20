"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getDeskAvailabilityRange, getClosures } from "@/lib/booking/availability";
import {
  validateDeskBookingDate,
  validateBookingTime,
  getAdvanceBookingLimit,
} from "@/lib/booking/rules";
import {
  toUTC,
  getBusinessHoursForDate,
  getBusinessHoursDuration,
  type BusinessHours,
} from "@/lib/booking/format";

// ── Helpers ────────────────────────────────────────────────────────────

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

// ── Get desk availability for calendar ─────────────────────────────────

export async function getDeskAvailability(
  startDate: string,
  endDate: string,
): Promise<
  Record<
    string,
    { available: number; total: number; closed: boolean; userBooked: boolean }
  >
> {
  const { supabase, user, spaceId } = await getContext();
  return getDeskAvailabilityRange(supabase, spaceId, user.id, startDate, endDate);
}

// ── Book a desk ────────────────────────────────────────────────────────

export async function bookDesk(
  date: string,
  startTime?: string,
  endTime?: string,
): Promise<
  | { success: true; bookingId: string; deskName: string; startTime: string; endTime: string }
  | { success: false; error: string }
> {
  const { supabase, user, spaceId } = await getContext();

  // 1. Get member
  const { data: member } = await supabase
    .from("members")
    .select("id, plan_id, status, fixed_desk_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!member) {
    return { success: false, error: "Active membership required to book desks" };
  }

  // 2. Get space info
  const { data: space } = await supabase
    .from("spaces")
    .select("timezone, business_hours, min_booking_minutes")
    .eq("id", spaceId)
    .single();

  if (!space) {
    return { success: false, error: "Space not found" };
  }

  const timezone = space.timezone;
  const businessHours = space.business_hours as BusinessHours;

  // 3. Get closures and validate date
  const closures = await getClosures(supabase, spaceId, date, date);
  const validation = validateDeskBookingDate(date, businessHours, timezone, closures);

  if (!validation.valid) {
    return { success: false, error: validation.error! };
  }

  // 4. Check user doesn't already have a desk booking on this date
  const hours = getBusinessHoursForDate(businessHours, date, timezone);
  if (!hours) {
    return { success: false, error: "Space is closed on this day" };
  }

  const dayStartUtc = toUTC(date, hours.open, timezone);
  const dayEndUtc = toUTC(date, hours.close, timezone);

  // Determine actual booking times (custom or full day)
  const bookingStartUtc = startTime ? toUTC(date, startTime, timezone) : dayStartUtc;
  const bookingEndUtc = endTime ? toUTC(date, endTime, timezone) : dayEndUtc;

  // Validate custom time range if provided
  if (startTime && endTime) {
    const timeValidation = validateBookingTime(
      bookingStartUtc,
      bookingEndUtc,
      businessHours,
      timezone,
      closures,
      space.min_booking_minutes,
      null, // no max for desks
    );
    if (!timeValidation.valid) {
      return { success: false, error: timeValidation.error! };
    }
  }

  const { data: existing } = await supabase
    .from("bookings")
    .select("id")
    .eq("user_id", user.id)
    .eq("space_id", spaceId)
    .in("status", ["confirmed", "checked_in"])
    .gte("start_time", dayStartUtc)
    .lt("start_time", dayEndUtc)
    .limit(1);

  if (existing && existing.length > 0) {
    return { success: false, error: "You already have a desk booking on this date" };
  }

  // 5. Check availability
  const { data: deskAvail } = await supabase.rpc("get_desk_availability", {
    p_space_id: spaceId,
    p_date: date,
  });

  const availableDesks = deskAvail?.[0]?.available_desks ?? 0;
  if (availableDesks <= 0) {
    return { success: false, error: "No desks available on this date" };
  }

  // 6. Find an available desk (lowest sort_order, not fixed, not booked, not pass-assigned)
  const { data: allDesks } = await supabase
    .from("resources")
    .select("id, name, resource_type:resource_types!inner(slug)")
    .eq("space_id", spaceId)
    .eq("resource_type.slug", "desk")
    .eq("status", "available")
    .order("sort_order", { ascending: true });

  if (!allDesks || allDesks.length === 0) {
    return { success: false, error: "No desks configured" };
  }

  // Exclude fixed desks of other members
  const { data: fixedDeskMembers } = await supabase
    .from("members")
    .select("fixed_desk_id")
    .eq("space_id", spaceId)
    .eq("status", "active")
    .not("fixed_desk_id", "is", null);

  const fixedDeskIds = new Set(
    (fixedDeskMembers ?? [])
      .map((m) => m.fixed_desk_id)
      .filter((id): id is string => id !== null),
  );

  // Exclude desks with overlapping bookings for the selected time range
  const { data: bookedDesks } = await supabase
    .from("bookings")
    .select("resource_id")
    .eq("space_id", spaceId)
    .in("status", ["confirmed", "checked_in"])
    .lt("start_time", bookingEndUtc)
    .gt("end_time", bookingStartUtc);

  const bookedDeskIds = new Set((bookedDesks ?? []).map((b) => b.resource_id));

  // Exclude desks with active passes on this date
  const { data: passDesks } = await supabase
    .from("passes")
    .select("assigned_desk_id")
    .eq("space_id", spaceId)
    .in("status", ["active"])
    .lte("start_date", date)
    .gte("end_date", date)
    .not("assigned_desk_id", "is", null);

  const passDeskIds = new Set(
    (passDesks ?? [])
      .map((p) => p.assigned_desk_id)
      .filter((id): id is string => id !== null),
  );

  const availableDesk = allDesks.find(
    (d) => !fixedDeskIds.has(d.id) && !bookedDeskIds.has(d.id) && !passDeskIds.has(d.id),
  );

  if (!availableDesk) {
    return { success: false, error: "No desks available on this date" };
  }

  // 7. Call create_booking_with_credits RPC
  const { data: bookingId, error: rpcError } = await supabase.rpc(
    "create_booking_with_credits",
    {
      p_space_id: spaceId,
      p_user_id: user.id,
      p_resource_id: availableDesk.id,
      p_start_time: bookingStartUtc,
      p_end_time: bookingEndUtc,
    },
  );

  if (rpcError) {
    // Insufficient credits or other RPC error
    if (rpcError.message.includes("insufficient") || rpcError.code === "P0002") {
      return {
        success: false,
        error: "Not enough desk credits. Purchase more in the Store.",
      };
    }
    return { success: false, error: rpcError.message };
  }

  revalidatePath("/book/desk");
  revalidatePath("/bookings");

  return {
    success: true,
    bookingId: bookingId as string,
    deskName: availableDesk.name,
    startTime: startTime ?? hours.open,
    endTime: endTime ?? hours.close,
  };
}
