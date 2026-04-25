import { NextResponse } from "next/server";
import { createLogger } from "@cowork/shared";
import { createAdminClient } from "@/lib/supabase/admin";

const BATCH_SIZE = 500;

/**
 * Daily cron: manage pass lifecycle transitions.
 * 1. upcoming → active: passes whose start_date has arrived
 * 2. active → expired: passes whose end_date has passed (clears desk assignment)
 *
 * Runs daily at 00:05 UTC. Configured in vercel.json.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logger = createLogger({ component: "cron/pass-lifecycle" });
  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0]!;

  let activated = 0;
  let expired = 0;
  let errors = 0;

  // 1. Transition upcoming → active (start_date <= today)
  let offset = 0;
  while (true) {
    const { data: passes, error: queryError } = await admin
      .from("passes")
      .select("id")
      .eq("status", "upcoming" as "active") // cast for ungenerated type
      .lte("start_date", today)
      .order("id")
      .range(offset, offset + BATCH_SIZE - 1);

    if (queryError) {
      logger.error("Failed to query upcoming passes", { error: queryError.message });
      break;
    }

    if (!passes || passes.length === 0) break;

    for (const pass of passes) {
      const { error: updateError } = await admin
        .from("passes")
        .update({ status: "active" as const, updated_at: new Date().toISOString() })
        .eq("id", pass.id);

      if (updateError) {
        errors++;
        logger.error("Failed to activate pass", { passId: pass.id, error: updateError.message });
      } else {
        activated++;
      }
    }

    if (passes.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  // 2. Transition active → expired (end_date < today)
  offset = 0;
  while (true) {
    const { data: passes, error: queryError } = await admin
      .from("passes")
      .select("id")
      .eq("status", "active")
      .lt("end_date", today)
      .order("id")
      .range(offset, offset + BATCH_SIZE - 1);

    if (queryError) {
      logger.error("Failed to query expired passes", { error: queryError.message });
      break;
    }

    if (!passes || passes.length === 0) break;

    for (const pass of passes) {
      const { error: updateError } = await admin
        .from("passes")
        .update({
          status: "expired" as const,
          assigned_desk_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pass.id);

      if (updateError) {
        errors++;
        logger.error("Failed to expire pass", { passId: pass.id, error: updateError.message });
      } else {
        expired++;
      }
    }

    if (passes.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  logger.info("Pass lifecycle completed", { activated, expired, errors });
  return NextResponse.json({ activated, expired, errors });
}
