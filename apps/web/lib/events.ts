import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

interface EventInput {
  spaceId: string;
  tenantId?: string;
  actorId?: string;
  actorType: "member" | "admin" | "system" | "stripe";
  eventType: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

/**
 * Fire-and-forget event recorder. Never throws.
 * Uses service-role client to bypass RLS (no insert policy on platform_events).
 */
export async function recordEvent(input: EventInput): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("platform_events").insert({
      space_id: input.spaceId,
      tenant_id: input.tenantId ?? null,
      actor_id: input.actorId ?? null,
      actor_type: input.actorType,
      event_type: input.eventType,
      resource_type: input.resourceType ?? null,
      resource_id: input.resourceId ?? null,
      metadata: input.metadata ?? {},
      ip: input.ip ?? null,
      user_agent: input.userAgent ?? null,
    });
    if (error) {
      console.error("[recordEvent] insert failed", {
        error: error.message,
        eventType: input.eventType,
      });
    }
  } catch (err) {
    console.error("[recordEvent] threw", {
      err: err instanceof Error ? err.message : "Unknown",
      eventType: input.eventType,
    });
  }
}

export type { EventInput };
