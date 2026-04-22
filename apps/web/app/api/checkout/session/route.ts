import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@cowork/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { getEffectiveFeePercent, calculateApplicationFee } from "@/lib/stripe/fees";
import { ensureStripePriceExists } from "@/lib/stripe/subscriptions";
import { ensureOneTimePriceExists } from "@/lib/stripe/checkout";
import { checkoutSessionSchema } from "../schemas";
import { getOrigin } from "@/lib/url";

export async function POST(request: NextRequest) {
  const spaceId = request.headers.get("x-space-id");
  const spaceSlug = request.headers.get("x-space-slug");
  if (!spaceId) {
    return NextResponse.json({ error: "Space not resolved" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = checkoutSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const { type, email, name, plan_slug, product_slug, start_date, community_rules_accepted } = parsed.data;
  const admin = createAdminClient();

  // Resolve tenant + Stripe account
  const { data: space } = await admin
    .from("spaces")
    .select(
      "tenant_id, daypass_enabled, daypass_daily_limit, daypass_price_cents, daypass_currency, daypass_stripe_price_id, slug",
    )
    .eq("id", spaceId)
    .single();

  if (!space) {
    return NextResponse.json({ error: "Space not found" }, { status: 404 });
  }

  const { data: tenant } = await admin
    .from("tenants")
    .select("stripe_account_id, platform_plan, platform_fee_percent")
    .eq("id", space.tenant_id)
    .single();

  if (!tenant?.stripe_account_id) {
    return NextResponse.json(
      { error: "Space is not set up for payments" },
      { status: 400 },
    );
  }

  const connectedAccountId = tenant.stripe_account_id;
  const feePercent = getEffectiveFeePercent(
    tenant.platform_plan ?? "free",
    tenant.platform_fee_percent,
  );

  const origin = getOrigin(request.headers);
  const slugParam = spaceSlug ? `?space=${spaceSlug}` : "";

  if (type === "product") {
    // Product-based pass checkout — pass is created in the webhook after payment,
    // matching the existing daypass guest flow (no pre-created pass record needed).
    const logger = createLogger({ component: "checkout/session", spaceId });

    const { data: product } = await admin
      .from("products")
      .select("id, name, slug, price_cents, currency, category, stripe_price_id, stripe_product_id")
      .eq("space_id", spaceId)
      .eq("slug", product_slug!)
      .eq("active", true)
      .single();

    if (!product || product.category !== "pass") {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const row = product as Record<string, unknown>;
    const passType = row.pass_type as string | null;
    const durationDays = (row.duration_days as number | null) ?? 1;

    if (!passType) {
      return NextResponse.json({ error: "Product not configured" }, { status: 400 });
    }

    // Validate start_date format
    const startDate = start_date!;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || isNaN(new Date(startDate + "T12:00:00Z").getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }

    // Reject past dates
    const today = new Date().toISOString().split("T")[0]!;
    if (startDate < today) {
      return NextResponse.json({ error: "Start date must not be in the past" }, { status: 400 });
    }

    // Calculate end date (skip weekends for multi-day consecutive passes)
    let endDate = startDate;
    if (durationDays > 1) {
      const cursor = new Date(startDate + "T12:00:00Z");
      let daysAssigned = 1;
      while (daysAssigned < durationDays) {
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        const dayOfWeek = cursor.getUTCDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          daysAssigned++;
        }
      }
      endDate = cursor.toISOString().split("T")[0]!;
    }

    // Check pass availability (max_pass_desks)
    const { data: spaceConfig } = await admin
      .from("spaces")
      .select("max_pass_desks")
      .eq("id", spaceId)
      .single();

    const maxPassDesks = (spaceConfig as Record<string, unknown> | null)
      ?.max_pass_desks as number | null;

    if (maxPassDesks !== null) {
      const { count } = await admin
        .from("passes")
        .select("id", { count: "exact", head: true })
        .eq("space_id", spaceId)
        .in("status", ["active"])
        .lte("start_date", endDate)
        .gte("end_date", startDate);

      if ((count ?? 0) >= maxPassDesks) {
        return NextResponse.json(
          { error: "No spots available for this date" },
          { status: 409 },
        );
      }
    }

    try {
      // Ensure Stripe price exists
      const priceId = await ensureOneTimePriceExists(
        product,
        connectedAccountId,
        spaceId,
      );

      const session = await getStripe().checkout.sessions.create(
        {
          mode: "payment",
          customer_email: email,
          line_items: [{ price: priceId, quantity: 1 }],
          payment_intent_data: {
            application_fee_amount: calculateApplicationFee(
              product.price_cents,
              feePercent,
            ),
          },
          success_url: `${origin}/checkout/confirmation?session_id={CHECKOUT_SESSION_ID}${slugParam ? `&space=${spaceSlug}` : ""}`,
          cancel_url: `${origin}/checkout/product?slug=${product.slug}${slugParam ? `&space=${spaceSlug}` : ""}`,
          metadata: {
            type: "product",
            guest_checkout: "true",
            space_id: spaceId,
            product_id: product.id,
            product_category: "pass",
            pass_type: passType,
            start_date: startDate,
            end_date: endDate,
            email,
            ...(name ? { name } : {}),
            ...(community_rules_accepted ? { community_rules_accepted: "true" } : {}),
          },
        },
        { stripeAccount: connectedAccountId },
      );

      return NextResponse.json({ url: session.url });
    } catch (err) {
      logger.error("Product checkout failed", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
    }
  }

  if (type === "daypass") {
    // Re-validate availability
    if (!space.daypass_enabled || !space.daypass_price_cents) {
      return NextResponse.json(
        { error: "Day passes are not available" },
        { status: 409 },
      );
    }

    if (space.daypass_daily_limit !== null) {
      const today = new Date().toISOString().split("T")[0];
      const { count } = await admin
        .from("passes")
        .select("id", { count: "exact", head: true })
        .eq("space_id", spaceId)
        .eq("start_date", today)
        .in("status", ["active", "used"]);

      if ((count ?? 0) >= space.daypass_daily_limit) {
        return NextResponse.json(
          { error: "No day passes available today" },
          { status: 409 },
        );
      }
    }

    // Ensure Stripe price exists for day pass
    let priceId = space.daypass_stripe_price_id;

    try {
      if (!priceId) {
        const stripeProduct = await getStripe().products.create(
          {
            name: "Day Pass",
            metadata: { space_id: spaceId },
          },
          { stripeAccount: connectedAccountId },
        );

        const stripePrice = await getStripe().prices.create(
          {
            product: stripeProduct.id,
            unit_amount: space.daypass_price_cents,
            currency: space.daypass_currency,
            metadata: { space_id: spaceId },
          },
          { stripeAccount: connectedAccountId },
        );

        priceId = stripePrice.id;
        await admin
          .from("spaces")
          .update({ daypass_stripe_price_id: priceId })
          .eq("id", spaceId);
      }

      const session = await getStripe().checkout.sessions.create(
        {
          mode: "payment",
          customer_email: email,
          line_items: [{ price: priceId, quantity: 1 }],
          payment_intent_data: {
            application_fee_amount: calculateApplicationFee(
              space.daypass_price_cents,
              feePercent,
            ),
          },
          success_url: `${origin}/checkout/confirmation?session_id={CHECKOUT_SESSION_ID}${slugParam ? `&space=${spaceSlug}` : ""}`,
          cancel_url: `${origin}/checkout/daypass${slugParam}`,
          metadata: {
            type: "daypass",
            guest_checkout: "true",
            space_id: spaceId,
            email,
            ...(name ? { name } : {}),
          },
        },
        { stripeAccount: connectedAccountId },
      );

      return NextResponse.json({ url: session.url });
    } catch (err) {
      createLogger({ component: "checkout/session", spaceId }).error("Daypass checkout failed", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
    }
  }

  // type === "membership"
  const { data: plan } = await admin
    .from("plans")
    .select(
      "id, name, price_cents, currency, capacity, stripe_price_id, stripe_product_id",
    )
    .eq("space_id", spaceId)
    .eq("slug", plan_slug!)
    .eq("active", true)
    .single();

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  // Re-validate capacity
  if (plan.capacity !== null) {
    const { count } = await admin
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("space_id", spaceId)
      .eq("plan_id", plan.id)
      .in("status", ["active", "paused"]);

    if ((count ?? 0) >= plan.capacity) {
      return NextResponse.json(
        { error: "This plan is at capacity" },
        { status: 409 },
      );
    }
  }

  // Ensure Stripe price exists for plan
  try {
    const priceId = await ensureStripePriceExists(
      plan,
      connectedAccountId,
      spaceId,
    );

    const session = await getStripe().checkout.sessions.create(
      {
        mode: "subscription",
        customer_email: email,
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: {
          application_fee_percent: feePercent,
          metadata: {
            space_id: spaceId,
            plan_id: plan.id,
          },
        },
        success_url: `${origin}/checkout/confirmation?session_id={CHECKOUT_SESSION_ID}${slugParam ? `&space=${spaceSlug}` : ""}`,
        cancel_url: `${origin}/checkout/membership?plan=${plan_slug}${slugParam ? `&space=${spaceSlug}` : ""}`,
        metadata: {
          type: "membership",
          guest_checkout: "true",
          space_id: spaceId,
          plan_slug: plan_slug!,
          plan_id: plan.id,
          email,
          ...(name ? { name } : {}),
          ...(community_rules_accepted ? { community_rules_accepted: "true" } : {}),
        },
      },
      { stripeAccount: connectedAccountId },
    );

    return NextResponse.json({ url: session.url });
  } catch (err) {
    createLogger({ component: "checkout/session", spaceId }).error("Membership checkout failed", {
      error: err instanceof Error ? err.message : "Unknown error",
    });
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
