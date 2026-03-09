"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { toUTC } from "@/lib/booking/format";

async function getAdminContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const spaceId = user.app_metadata?.space_id as string | undefined;
  if (!spaceId) throw new Error("No space context");
  return { supabase, user, spaceId };
}

// ── Admin check-in ─────────────────────────────────────────────────────

export async function adminCheckIn(
  bookingId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const { supabase, spaceId } = await getAdminContext();

  const { error } = await supabase
    .from("bookings")
    .update({
      status: "checked_in" as const,
      checked_in_at: new Date().toISOString(),
    })
    .eq("id", bookingId)
    .eq("space_id", spaceId)
    .in("status", ["confirmed"]);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/bookings");
  return { success: true };
}

// ── Admin check-out ────────────────────────────────────────────────────

export async function adminCheckOut(
  bookingId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const { supabase, spaceId } = await getAdminContext();

  const { error } = await supabase
    .from("bookings")
    .update({
      status: "completed" as const,
      checked_out_at: new Date().toISOString(),
    })
    .eq("id", bookingId)
    .eq("space_id", spaceId)
    .eq("status", "checked_in");

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/bookings");
  return { success: true };
}

// ── Admin cancel booking ───────────────────────────────────────────────

export async function adminCancelBooking(
  bookingId: string,
  userId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const { supabase, spaceId } = await getAdminContext();

  const { error } = await supabase.rpc("cancel_booking_refund_credits", {
    p_space_id: spaceId,
    p_booking_id: bookingId,
    p_user_id: userId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/bookings");
  return { success: true };
}

// ── Admin walk-in booking ──────────────────────────────────────────────

export async function adminCreateBooking(
  userId: string,
  resourceId: string,
  startTime: string,
  endTime: string,
): Promise<{ success: true; bookingId: string } | { success: false; error: string }> {
  const { supabase, spaceId } = await getAdminContext();

  // Admin override: insert directly without credit deduction
  const durationMinutes = Math.round(
    (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60_000,
  );

  const { data: resource } = await supabase
    .from("resources")
    .select("resource_type_id")
    .eq("id", resourceId)
    .single();

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      space_id: spaceId,
      user_id: userId,
      resource_id: resourceId,
      start_time: startTime,
      end_time: endTime,
      status: "confirmed" as const,
      duration_minutes: durationMinutes,
      credit_type_id: resource?.resource_type_id ?? null,
      credits_deducted: 0,
    })
    .select("id")
    .single();

  if (error) {
    // EXCLUDE constraint = overlap
    if (error.code === "23P01") {
      return { success: false, error: "Time slot overlaps with an existing booking" };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/bookings");
  return { success: true, bookingId: booking.id };
}

// ── Admin walk-in booking (timezone-aware) ────────────────────────────

export async function adminCreateWalkIn(
  userId: string,
  resourceId: string,
  date: string,
  startTimeLocal: string,
  endTimeLocal: string,
): Promise<{ success: true; bookingId: string } | { success: false; error: string }> {
  const { supabase, spaceId } = await getAdminContext();

  const { data: space } = await supabase
    .from("spaces")
    .select("timezone")
    .eq("id", spaceId)
    .single();

  const timezone = space?.timezone ?? "Europe/Madrid";
  const startUtc = toUTC(date, startTimeLocal, timezone);
  const endUtc = toUTC(date, endTimeLocal, timezone);

  return adminCreateBooking(userId, resourceId, startUtc, endUtc);
}

// ── Fetch form data for walk-in dialog ────────────────────────────────

export async function getWalkInFormData() {
  const { supabase, spaceId } = await getAdminContext();

  const [{ data: members }, { data: resources }] = await Promise.all([
    supabase
      .from("members")
      .select("user_id")
      .eq("space_id", spaceId)
      .eq("status", "active"),
    supabase
      .from("resources")
      .select("id, name, resource_type:resource_types!inner(slug, name)")
      .eq("space_id", spaceId)
      .eq("status", "available")
      .order("sort_order", { ascending: true }),
  ]);

  const userIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = userIds.length > 0
    ? await supabase
        .from("shared_profiles")
        .select("id, full_name, email")
        .in("id", userIds)
    : { data: [] as { id: string; full_name: string | null; email: string }[] };

  return {
    members: (profiles ?? []).map((p) => ({
      userId: p.id,
      label: p.full_name ?? p.email,
    })),
    resources: (resources ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      type: (r.resource_type as { slug: string; name: string }).name,
    })),
  };
}

// ── Fetch daily bookings for a specific date ───────────────────────────

export async function getDailyBookings(date: string) {
  const { supabase, spaceId } = await getAdminContext();

  const { data: space } = await supabase
    .from("spaces")
    .select("timezone, business_hours")
    .eq("id", spaceId)
    .single();

  const timezone = space?.timezone ?? "Europe/Madrid";

  // Fetch bookings, active passes, and fixed desk members in parallel
  const [{ data: bookings }, { data: passes }, { data: fixedDeskMembers }] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, user_id, start_time, end_time, status, checked_in_at, checked_out_at, credits_deducted, resource:resources!inner(id, name, resource_type:resource_types!inner(slug, name))",
      )
      .eq("space_id", spaceId)
      .gte("start_time", date + "T00:00:00Z")
      .lt("start_time", date + "T23:59:59Z")
      .in("status", ["confirmed", "checked_in", "completed"])
      .order("start_time", { ascending: true }),

    supabase
      .from("passes")
      .select("id, user_id, pass_type, status, start_date, end_date, assigned_desk_id")
      .eq("space_id", spaceId)
      .eq("status", "active")
      .lte("start_date", date)
      .gte("end_date", date),

    supabase
      .from("members")
      .select("id, user_id, fixed_desk_id")
      .eq("space_id", spaceId)
      .eq("status", "active")
      .not("fixed_desk_id", "is", null),
  ]);

  // Resolve desk names for passes and fixed desk members
  const deskIds = new Set<string>();
  for (const p of passes ?? []) {
    if (p.assigned_desk_id) deskIds.add(p.assigned_desk_id);
  }
  for (const m of fixedDeskMembers ?? []) {
    if (m.fixed_desk_id) deskIds.add(m.fixed_desk_id as string);
  }

  const { data: deskResources } = deskIds.size > 0
    ? await supabase.from("resources").select("id, name").in("id", [...deskIds])
    : { data: [] as { id: string; name: string }[] };

  const deskNameMap = Object.fromEntries(
    (deskResources ?? []).map((r) => [r.id, r.name]),
  );

  // Collect all user IDs for profile lookup
  const userIds = new Set<string>();
  for (const b of bookings ?? []) userIds.add(b.user_id);
  for (const p of passes ?? []) userIds.add(p.user_id);
  for (const m of fixedDeskMembers ?? []) userIds.add(m.user_id);

  const { data: profiles } = userIds.size > 0
    ? await supabase
        .from("shared_profiles")
        .select("id, full_name, email")
        .in("id", [...userIds])
    : { data: [] as { id: string; full_name: string | null; email: string }[] };

  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, { full_name: p.full_name, email: p.email }]),
  );

  return {
    bookings: bookings ?? [],
    passes: (passes ?? []).map((p) => ({
      ...p,
      desk_name: p.assigned_desk_id ? deskNameMap[p.assigned_desk_id] ?? null : null,
    })),
    fixedDeskMembers: (fixedDeskMembers ?? []).map((m) => ({
      ...m,
      desk_name: m.fixed_desk_id ? deskNameMap[m.fixed_desk_id as string] ?? null : null,
    })),
    profileMap,
    timezone,
  };
}
