"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

// ── Cancel booking ─────────────────────────────────────────────────────

export async function cancelBooking(
  bookingId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const { supabase, user, spaceId } = await getContext();

  const { error } = await supabase.rpc("cancel_booking_refund_credits", {
    p_space_id: spaceId,
    p_booking_id: bookingId,
    p_user_id: user.id,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/bookings");
  revalidatePath("/book/desk");
  return { success: true };
}

// ── Self check-in ──────────────────────────────────────────────────────

export async function checkIn(
  bookingId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const { supabase, user, spaceId } = await getContext();

  // Verify booking belongs to user and is today
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, status, start_time, end_time")
    .eq("id", bookingId)
    .eq("user_id", user.id)
    .eq("space_id", spaceId)
    .single();

  if (!booking) {
    return { success: false, error: "Booking not found" };
  }

  if (booking.status !== "confirmed") {
    return { success: false, error: "Booking must be in confirmed status to check in" };
  }

  // Check-in window: 15 minutes before start to end time
  const now = new Date();
  const start = new Date(booking.start_time);
  const end = new Date(booking.end_time);
  const windowStart = new Date(start.getTime() - 15 * 60_000);

  if (now < windowStart) {
    return { success: false, error: "Check-in is not yet available" };
  }
  if (now > end) {
    return { success: false, error: "Booking has already ended" };
  }

  const { error } = await supabase
    .from("bookings")
    .update({
      status: "checked_in" as const,
      checked_in_at: new Date().toISOString(),
    })
    .eq("id", bookingId)
    .eq("user_id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/bookings");
  return { success: true };
}

// ── Self check-out ─────────────────────────────────────────────────────

export async function checkOut(
  bookingId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const { supabase, user, spaceId } = await getContext();

  const { error } = await supabase
    .from("bookings")
    .update({
      status: "completed" as const,
      checked_out_at: new Date().toISOString(),
    })
    .eq("id", bookingId)
    .eq("user_id", user.id)
    .eq("status", "checked_in");

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/bookings");
  return { success: true };
}
