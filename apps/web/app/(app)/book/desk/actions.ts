"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { getDeskAvailabilityRange, getClosures } from "@/lib/booking/availability";
import { notifyBookingConfirmation } from "@/lib/email/notifications";
import { recordEvent } from "@/lib/events";
import {
  validateDeskBookingDate,
  validateBookingTime,
} from "@/lib/booking/rules";
import { toUTC, getBusinessHoursForDate, type BusinessHours } from "@/lib/booking/format";

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

  // Fire-and-forget booking confirmation email
  notifyBookingConfirmation({
    spaceId,
    userId: user.id,
    resourceName: desk.name,
    date,
    startTime,
    endTime,
  });

  // Fire-and-forget event recording
  const h = await headers();
  recordEvent({
    spaceId,
    tenantId: user.app_metadata?.tenant_id as string | undefined,
    actorId: user.id,
    actorType: "member",
    eventType: "booking.created",
    resourceType: "booking",
    resourceId: bookingId as string,
    metadata: { desk_name: desk.name, date, start_time: startTime, end_time: endTime },
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim(),
    userAgent: h.get("user-agent") ?? undefined,
  });

  return {
    success: true,
    bookingId: bookingId as string,
    startTime,
    endTime,
  };
}

// ── Get desk slot availability for a date ─────────────────────────────

export interface DeskTimeSlot {
  time: string;
  availableDesks: number;
  userBooked: boolean;
}

export async function getDeskSlotAvailability(
  date: string,
): Promise<DeskTimeSlot[]> {
  const { supabase, user, spaceId } = await getContext();

  const { data: space } = await supabase
    .from("spaces")
    .select("timezone, business_hours")
    .eq("id", spaceId)
    .single();

  if (!space) return [];

  const timezone = space.timezone;
  const businessHours = space.business_hours as BusinessHours;
  const hours = getBusinessHoursForDate(businessHours, date, timezone);
  if (!hours) return [];

  // Generate 30-min time points
  const timePoints = generateSlotTimes(hours.open, hours.close);
  if (timePoints.length < 2) return [];

  // Get all available desks
  const { data: allDesks } = await supabase
    .from("resources")
    .select("id, resource_type:resource_types!inner(slug)")
    .eq("space_id", spaceId)
    .eq("resource_type.slug", "desk")
    .eq("status", "available");

  if (!allDesks || allDesks.length === 0) {
    return timePoints.slice(0, -1).map((time) => ({
      time,
      availableDesks: 0,
      userBooked: false,
    }));
  }

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

  // Pass-reserved desks for this date
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

  const availableDeskIds = allDesks
    .filter((d) => !fixedDeskIds.has(d.id) && !passDeskIds.has(d.id))
    .map((d) => d.id);

  const totalAvailable = availableDeskIds.length;

  // Get all desk bookings for this date
  const dayStartUtc = toUTC(date, hours.open, timezone);
  const dayEndUtc = toUTC(date, hours.close, timezone);

  const { data: deskBookings } = await supabase
    .from("bookings")
    .select("resource_id, start_time, end_time")
    .eq("space_id", spaceId)
    .in("status", ["confirmed", "checked_in"])
    .lt("start_time", dayEndUtc)
    .gt("end_time", dayStartUtc)
    .in("resource_id", availableDeskIds);

  // Get user's bookings for this date
  const { data: userBookings } = await supabase
    .from("bookings")
    .select("start_time, end_time")
    .eq("user_id", user.id)
    .eq("space_id", spaceId)
    .in("status", ["confirmed", "checked_in"])
    .lt("start_time", dayEndUtc)
    .gt("end_time", dayStartUtc);

  // Compute per-slot availability
  const result: DeskTimeSlot[] = [];
  for (let i = 0; i < timePoints.length - 1; i++) {
    const slotStartUtc = toUTC(date, timePoints[i]!, timezone);
    const slotEndUtc = toUTC(date, timePoints[i + 1]!, timezone);

    const bookedCount = new Set(
      (deskBookings ?? [])
        .filter((b) => b.start_time < slotEndUtc && b.end_time > slotStartUtc)
        .map((b) => b.resource_id),
    ).size;

    const userBooked = (userBookings ?? []).some(
      (b) => b.start_time < slotEndUtc && b.end_time > slotStartUtc,
    );

    result.push({
      time: timePoints[i]!,
      availableDesks: Math.max(0, totalAvailable - bookedCount),
      userBooked,
    });
  }

  return result;
}

function generateSlotTimes(open: string, close: string): string[] {
  const [openH, openM] = open.split(":").map(Number) as [number, number];
  const [closeH, closeM] = close.split(":").map(Number) as [number, number];
  const openMin = openH * 60 + openM;
  const closeMin = closeH * 60 + closeM;

  const slots: string[] = [];
  for (let m = openMin; m <= closeMin; m += 30) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(
      `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`,
    );
  }
  return slots;
}

// ── Get available desks for a time range ──────────────────────────────

export async function getAvailableDesks(
  date: string,
  startTime: string,
  endTime: string,
): Promise<{ id: string; name: string; image_url: string | null }[]> {
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
    .select("id, name, image_url, resource_type:resource_types!inner(slug)")
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
    .map((d) => ({ id: d.id, name: d.name, image_url: d.image_url }));
}
