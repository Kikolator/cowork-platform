import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const { type, plan_slug } = parsed.data;
  const admin = createAdminClient();

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
