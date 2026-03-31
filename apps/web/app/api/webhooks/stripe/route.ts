import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { createLogger } from "@cowork/shared";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { routeWebhookEvent } from "@/lib/stripe/webhooks";

export async function POST(request: NextRequest) {
  const logger = createLogger({ component: "stripe/route" });
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  // Verify the webhook signature
  // Try Connect secret first (most events), fall back to platform secret
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_CONNECT_WEBHOOK_SECRET!,
    );
  } catch {
    try {
      event = getStripe().webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  }

  // Resolve space from the connected account
  const connectedAccountId = event.account;
  let spaceId: string | null = null;
  let tenantId: string | null = null;

  const admin = createAdminClient();

  if (connectedAccountId) {
    const { data: tenant } = await admin
      .from("tenants")
      .select("id, spaces(id)")
      .eq("stripe_account_id", connectedAccountId)
      .single();

    if (!tenant) {
      logger.error("Webhook for unknown Stripe account", { connectedAccountId });
      return NextResponse.json({ received: true });
    }

    tenantId = tenant.id;
    const spaces = tenant.spaces as unknown as Array<{ id: string }>;
    spaceId = spaces?.[0]?.id ?? null;
  }

  // Log the event (regardless of processing outcome)
  if (spaceId) {
    // Idempotency: check if already processed
    const { data: existing } = await admin
      .from("payment_events")
      .select("id, processed")
      .eq("stripe_event_id", event.id)
      .single();

    if (existing?.processed) {
      return NextResponse.json({ received: true });
    }

    // Extract customer ID and user ID from event payload when available
    const eventObject = event.data.object as unknown as Record<string, unknown>;
    const stripeCustomerId =
      (typeof eventObject.customer === "string" ? eventObject.customer : null) ?? null;
    const eventUserId =
      ((eventObject.metadata as Record<string, unknown> | undefined)?.user_id as string | undefined) ?? null;

    const { error: upsertError } = await admin.from("payment_events").upsert(
      {
        stripe_event_id: event.id,
        event_type: event.type,
        stripe_account_id: connectedAccountId ?? null,
        stripe_customer_id: stripeCustomerId,
        user_id: eventUserId,
        space_id: spaceId,
        payload: event.data as unknown as Record<string, never>,
        processed: false,
      },
      { onConflict: "stripe_event_id" },
    );

    if (upsertError) {
      logger.error("Failed to log payment event", { eventId: event.id, error: upsertError.message });
    }
  }

  // Route to handler based on event type
  try {
    await routeWebhookEvent(event, spaceId, tenantId);

    if (spaceId) {
      await admin
        .from("payment_events")
        .update({ processed: true })
        .eq("stripe_event_id", event.id);
    }
  } catch (err) {
    logger.error("Webhook handler error", { eventType: event.type, spaceId, error: err instanceof Error ? err.message : "Unknown error" });
    if (spaceId) {
      await admin
        .from("payment_events")
        .update({
          processed: false,
          error: err instanceof Error ? err.message : "Unknown error",
        })
        .eq("stripe_event_id", event.id);
    }
  }

  // Always return 200 — Stripe retries on non-2xx
  return NextResponse.json({ received: true });
}
