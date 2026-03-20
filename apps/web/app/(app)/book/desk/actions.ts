"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getDeskAvailabilityRange, getClosures } from "@/lib/booking/availability";
import {
  validateDeskBookingDate,
  validateBookingTime,
} from "@/lib/booking/rules";
import { toUTC, type BusinessHours } from "@/lib/booking/format";

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
  startTime: string,
  endTime: string,
  resourceId: string,
): Promise<
  | { success: true; bookingId: string; startTime: string; endTime: string }
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

  // 4. Convert times and validate
  const bookingStartUtc = toUTC(date, startTime, timezone);
  const bookingEndUtc = toUTC(date, endTime, timezone);

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

  // Check for overlapping bookings by this user on the same day
  const { data: overlapping } = await supabase
    .from("bookings")
    .select("id")
    .eq("user_id", user.id)
    .eq("space_id", spaceId)
    .in("status", ["confirmed", "checked_in"])
    .lt("start_time", bookingEndUtc)
    .gt("end_time", bookingStartUtc)
    .limit(1);

  if (overlapping && overlapping.length > 0) {
    return { success: false, error: "You already have a booking during this time slot" };
  }

  // 5. Validate the requested desk is available
  const { data: desk } = await supabase
    .from("resources")
    .select("id, name, resource_type:resource_types!inner(slug)")
    .eq("id", resourceId)
    .eq("space_id", spaceId)
    .eq("resource_type.slug", "desk")
    .eq("status", "available")
    .maybeSingle();

  if (!desk) {
    return { success: false, error: "Selected desk is not available" };
  }

  // Ensure it's not a fixed desk of another member
  const { data: fixedOwner } = await supabase
    .from("members")
    .select("id")
    .eq("fixed_desk_id", resourceId)
    .eq("space_id", spaceId)
    .eq("status", "active")
    .neq("user_id", user.id)
    .maybeSingle();

  if (fixedOwner) {
    return { success: false, error: "This desk is assigned to another member" };
  }

  // Ensure no overlapping booking on this desk
  const { data: deskConflict } = await supabase
    .from("bookings")
    .select("id")
    .eq("resource_id", resourceId)
    .eq("space_id", spaceId)
    .in("status", ["confirmed", "checked_in"])
    .lt("start_time", bookingEndUtc)
    .gt("end_time", bookingStartUtc)
    .limit(1);

  if (deskConflict && deskConflict.length > 0) {
    return { success: false, error: "This desk is already booked for the selected time" };
  }

  // Ensure no active pass on this desk for this date
  const { data: passConflict } = await supabase
    .from("passes")
    .select("id")
    .eq("assigned_desk_id", resourceId)
    .eq("space_id", spaceId)
    .in("status", ["active"])
    .lte("start_date", date)
    .gte("end_date", date)
    .limit(1);

  if (passConflict && passConflict.length > 0) {
    return { success: false, error: "This desk is reserved by a pass holder" };
  }

  // 6. Call create_booking_with_credits RPC
  const { data: bookingId, error: rpcError } = await supabase.rpc(
    "create_booking_with_credits",
    {
      p_space_id: spaceId,
      p_user_id: user.id,
      p_resource_id: resourceId,
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
    startTime,
    endTime,
  };
}

// ── Get available desks for a time range ──────────────────────────────

export async function getAvailableDesks(
  date: string,
  startTime: string,
  endTime: string,
): Promise<{ id: string; name: string }[]> {
  const { supabase, user, spaceId } = await getContext();

  // Get space timezone
  const { data: space } = await supabase
    .from("spaces")
    .select("timezone")
    .eq("id", spaceId)
    .single();

  if (!space) return [];

  const bookingStartUtc = toUTC(date, startTime, space.timezone);
  const bookingEndUtc = toUTC(date, endTime, space.timezone);

  // All desks in the space
  const { data: allDesks } = await supabase
    .from("resources")
    .select("id, name, resource_type:resource_types!inner(slug)")
    .eq("space_id", spaceId)
    .eq("resource_type.slug", "desk")
    .eq("status", "available")
    .order("sort_order", { ascending: true });

  if (!allDesks || allDesks.length === 0) return [];

  // Fixed desks of other members
  const { data: fixedDeskMembers } = await supabase
    .from("members")
    .select("fixed_desk_id")
    .eq("space_id", spaceId)
    .eq("status", "active")
    .not("fixed_desk_id", "is", null)
    .neq("user_id", user.id);

  const fixedDeskIds = new Set(
    (fixedDeskMembers ?? [])
      .map((m) => m.fixed_desk_id)
      .filter((id): id is string => id !== null),
  );

  // Desks with overlapping bookings
  const { data: bookedDesks } = await supabase
    .from("bookings")
    .select("resource_id")
    .eq("space_id", spaceId)
    .in("status", ["confirmed", "checked_in"])
    .lt("start_time", bookingEndUtc)
    .gt("end_time", bookingStartUtc);

  const bookedDeskIds = new Set((bookedDesks ?? []).map((b) => b.resource_id));

  // Desks with active passes on this date
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

  return allDesks
    .filter((d) => !fixedDeskIds.has(d.id) && !bookedDeskIds.has(d.id) && !passDeskIds.has(d.id))
    .map((d) => ({ id: d.id, name: d.name }));
}
