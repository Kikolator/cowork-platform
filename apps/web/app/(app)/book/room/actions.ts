"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getRoomSlots, getClosures } from "@/lib/booking/availability";
import { validateBookingTime } from "@/lib/booking/rules";
import type { BusinessHours } from "@/lib/booking/format";

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

// ── Get room slots ─────────────────────────────────────────────────────

export async function getRoomAvailability(
  resourceId: string,
  date: string,
): Promise<
  { slotStart: string; slotEnd: string; isAvailable: boolean }[]
> {
  const { supabase, spaceId } = await getContext();
  return getRoomSlots(supabase, spaceId, resourceId, date);
}

// ── Book a room ────────────────────────────────────────────────────────

export async function bookRoom(
  resourceId: string,
  startTime: string,
  endTime: string,
): Promise<
  | { success: true; bookingId: string }
  | { success: false; error: string }
> {
  const { supabase, user, spaceId } = await getContext();

  // 1. Get member
  const { data: member } = await supabase
    .from("members")
    .select("id, plan_id, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!member) {
    return { success: false, error: "Active membership required to book rooms" };
  }

  // 2. Get space config
  const { data: space } = await supabase
    .from("spaces")
    .select("timezone, business_hours")
    .eq("id", spaceId)
    .single();

  if (!space) {
    return { success: false, error: "Space not found" };
  }

  const timezone = space.timezone;
  const businessHours = space.business_hours as BusinessHours;

  // 3. Validate booking time
  const dateStr = startTime.slice(0, 10);
  const closures = await getClosures(supabase, spaceId, dateStr, dateStr);
  const validation = validateBookingTime(
    startTime,
    endTime,
    businessHours,
    timezone,
    closures,
  );

  if (!validation.valid) {
    return { success: false, error: validation.error! };
  }

  // 4. Call create_booking_with_credits RPC
  const { data: bookingId, error: rpcError } = await supabase.rpc(
    "create_booking_with_credits",
    {
      p_space_id: spaceId,
      p_user_id: user.id,
      p_resource_id: resourceId,
      p_start_time: startTime,
      p_end_time: endTime,
    },
  );

  if (rpcError) {
    // EXCLUDE constraint violation = slot taken
    if (rpcError.code === "23P01") {
      return { success: false, error: "Slot no longer available — someone else booked it" };
    }
    if (rpcError.message.includes("insufficient") || rpcError.code === "P0002") {
      return {
        success: false,
        error: "Not enough credits. Purchase more in the Store.",
      };
    }
    return { success: false, error: rpcError.message };
  }

  revalidatePath(`/book/room/${resourceId}`);
  revalidatePath("/bookings");

  return { success: true, bookingId: bookingId as string };
}
