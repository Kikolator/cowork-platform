import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSpaceClosedOnDate, calculatePassEndDate } from "@/lib/space/closures";
import type { BusinessHours } from "@/lib/booking/format";
import { availabilityQuerySchema } from "../schemas";

export async function GET(request: NextRequest) {
  const spaceId = request.headers.get("x-space-id");
  if (!spaceId) {
    return NextResponse.json(
      { error: "Space not resolved" },
      { status: 400 },
    );
  }

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = availabilityQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid parameters" },
      { status: 400 },
    );
  }

  const { type, plan_slug, product_slug, date, email } = parsed.data;
  const admin = createAdminClient();

  if (type === "product") {
    // Product-based pass availability
    const { data: product } = await admin
      .from("products")
      .select("id, category, pass_type, duration_days")
      .eq("space_id", spaceId)
      .eq("slug", product_slug!)
      .eq("active", true)
      .single();

    if (!product || product.category !== "pass") {
      return NextResponse.json({ available: false });
    }

    const row = product as Record<string, unknown>;
    const passType = row.pass_type as string | null;
    const durationDays = (row.duration_days as number | null) ?? 1;

    if (!passType) {
      return NextResponse.json({ available: false });
    }

    const startDate = date!;

    // Fetch space config for closure/business hours checks
    const { data: space } = await admin
      .from("spaces")
      .select("*") // includes max_pass_desks, business_hours, timezone (some not yet in generated types)
      .eq("id", spaceId)
      .single();

    const spaceRow = space as Record<string, unknown> | null;
    const maxPassDesks = (spaceRow?.max_pass_desks as number | null) ?? null;
    const businessHours = (space?.business_hours ?? {}) as BusinessHours;
    const timezone = space?.timezone ?? "UTC";

    // Check if start date is closed (weekend or closure)
    const closedCheck = await isSpaceClosedOnDate(admin, spaceId, startDate, businessHours, timezone);
    if (closedCheck.closed) {
      return NextResponse.json({
        available: false,
        reason: closedCheck.reason,
      });
    }

    // Calculate end date skipping weekends AND closures
    const endDate = await calculatePassEndDate(
      admin, spaceId, startDate, durationDays, businessHours, timezone,
    );

    // Check for duplicate passes by email
    let hasExistingPass = false;
    if (email) {
      const { data: existingPasses } = await admin
        .from("passes")
        .select("id, user:shared_profiles!user_id(email)")
        .eq("space_id", spaceId)
        .in("status", ["active", "upcoming" as "active"])
        .lte("start_date", endDate)
        .gte("end_date", startDate);

      hasExistingPass = existingPasses?.some((p) => {
        const u = p.user as unknown;
        return (
          u !== null &&
          typeof u === "object" &&
          "email" in (u as Record<string, unknown>) &&
          (u as Record<string, unknown>).email === email
        );
      }) ?? false;
    }

    // Count active passes overlapping any day in the range
    const { count: activePassCount } = await admin
      .from("passes")
      .select("id", { count: "exact", head: true })
      .eq("space_id", spaceId)
      .in("status", ["active", "upcoming" as "active"]) // upcoming not yet in generated types
      .lte("start_date", endDate)
      .gte("end_date", startDate);

    const activePasses = activePassCount ?? 0;

    if (maxPassDesks !== null) {
      const spotsLeft = Math.max(maxPassDesks - activePasses, 0);
      return NextResponse.json({
        available: spotsLeft > 0,
        spots_left: spotsLeft,
        has_existing_pass: hasExistingPass,
      });
    }

    // No pass desk limit — check general desk availability.
    const { data: deskAvail } = await admin.rpc("get_desk_availability", {
      p_space_id: spaceId,
      p_date: startDate,
    });

    if (deskAvail && Array.isArray(deskAvail) && deskAvail.length > 0) {
      const { available_desks } = deskAvail[0] as { available_desks: number };
      return NextResponse.json({
        available: available_desks > 0,
        spots_left: available_desks <= 10 ? available_desks : null,
        has_existing_pass: hasExistingPass,
      });
    }

    return NextResponse.json({ available: true, spots_left: null, has_existing_pass: hasExistingPass });
  }

  if (type === "daypass") {
    const { data: space, error } = await admin
      .from("spaces")
      .select(
        "daypass_enabled, daypass_daily_limit, daypass_price_cents, daypass_currency",
      )
      .eq("id", spaceId)
      .single();

    if (error || !space) {
      return NextResponse.json(
        { error: "Space not found" },
        { status: 404 },
      );
    }

    if (!space.daypass_enabled) {
      return NextResponse.json({ available: false });
    }

    if (space.daypass_daily_limit !== null) {
      const today = new Date().toISOString().split("T")[0];
      const { count } = await admin
        .from("passes")
        .select("id", { count: "exact", head: true })
        .eq("space_id", spaceId)
        .eq("start_date", today)
        .in("status", ["active", "used"]);

      const sold = count ?? 0;
      const spotsLeft = space.daypass_daily_limit - sold;

      return NextResponse.json({
        available: spotsLeft > 0,
        spotsLeft: Math.max(spotsLeft, 0),
      });
    }

    return NextResponse.json({ available: true });
  }

  // type === "membership"
  const { data: plan, error: planError } = await admin
    .from("plans")
    .select("id, name, description, price_cents, currency, capacity")
    .eq("space_id", spaceId)
    .eq("slug", plan_slug!)
    .eq("active", true)
    .single();

  if (planError || !plan) {
    return NextResponse.json(
      { error: "Plan not found" },
      { status: 404 },
    );
  }

  if (plan.capacity !== null) {
    const { count } = await admin
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("space_id", spaceId)
      .eq("plan_id", plan.id)
      .in("status", ["active", "paused"]);

    const activeMembers = count ?? 0;
    const spotsLeft = plan.capacity - activeMembers;

    return NextResponse.json({
      available: spotsLeft > 0,
      spotsLeft: Math.max(spotsLeft, 0),
      plan: {
        name: plan.name,
        price_cents: plan.price_cents,
        currency: plan.currency,
        description: plan.description,
      },
    });
  }

  return NextResponse.json({
    available: true,
    plan: {
      name: plan.name,
      price_cents: plan.price_cents,
      currency: plan.currency,
      description: plan.description,
    },
  });
}
