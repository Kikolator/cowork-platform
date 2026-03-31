import "server-only";

import { createLogger } from "@cowork/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { listAuths, createAuth, updateAuth, deleteAuth } from "./client";
import { generatePin } from "./pin";

interface BusinessHours {
  [key: string]: { open: string; close: string } | null;
}

/** Nuki weekday bitmask: Mon=64, Tue=32, Wed=16, Thu=8, Fri=4, Sat=2, Sun=1 */
const DAY_BITS: Record<string, number> = {
  mon: 64,
  tue: 32,
  wed: 16,
  thu: 8,
  fri: 4,
  sat: 2,
  sun: 1,
};

/** Convert "HH:MM" to minutes since midnight */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Build Nuki time restrictions from the member's access type and space business hours.
 *
 * Returns { allowedWeekDays, allowedFromTime, allowedUntilTime }
 */
function buildTimeRestrictions(
  accessType: string,
  businessHours: BusinessHours,
): { allowedWeekDays: number; allowedFromTime: number; allowedUntilTime: number } {
  if (accessType === "twenty_four_seven") {
    return { allowedWeekDays: 127, allowedFromTime: 0, allowedUntilTime: 0 };
  }

  if (accessType === "extended") {
    // Extended: all days, 07:00-22:00
    return {
      allowedWeekDays: 127,
      allowedFromTime: timeToMinutes("07:00"),
      allowedUntilTime: timeToMinutes("22:00"),
    };
  }

  // business_hours: only open days, during configured hours
  let weekDays = 0;
  let earliestOpen = 1440; // minutes in a day
  let latestClose = 0;

  for (const [day, hours] of Object.entries(businessHours)) {
    if (!hours) continue;
    const bit = DAY_BITS[day];
    if (bit) {
      weekDays |= bit;
      const open = timeToMinutes(hours.open);
      const close = timeToMinutes(hours.close);
      if (open < earliestOpen) earliestOpen = open;
      if (close > latestClose) latestClose = close;
    }
  }

  // Fallback if no business hours configured
  if (weekDays === 0) {
    return { allowedWeekDays: 124, allowedFromTime: timeToMinutes("09:00"), allowedUntilTime: timeToMinutes("18:00") };
  }

  return { allowedWeekDays: weekDays, allowedFromTime: earliestOpen, allowedUntilTime: latestClose };
}

/**
 * Sync Nuki keypad codes for all active members of a space.
 *
 * - Creates codes for active members without one
 * - Updates codes for members whose access type changed
 * - Deletes codes for churned/cancelled members
 */
export async function syncNukiCodes(spaceId: string): Promise<{
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}> {
  const admin = createAdminClient();
  const result = { created: 0, updated: 0, deleted: 0, errors: [] as string[] };

  // Fetch space access config
  const { data: config } = await admin
    .from("space_access_config")
    .select("*")
    .eq("space_id", spaceId)
    .single();

  if (!config || !config.enabled || config.mode !== "nuki") {
    throw new Error("Nuki mode is not enabled for this space");
  }

  if (!config.nuki_api_token || !config.nuki_smartlock_id) {
    throw new Error("Nuki API token and smartlock ID are required");
  }

  // Fetch space business hours
  const { data: space } = await admin
    .from("spaces")
    .select("business_hours")
    .eq("id", spaceId)
    .single();

  const businessHours = (space?.business_hours ?? {}) as BusinessHours;

  // Fetch all members with their plans
  const { data: members } = await admin
    .from("members")
    .select("id, user_id, status, access_code, nuki_auth_id, plans!inner(access_type)")
    .eq("space_id", spaceId);

  if (!members) {
    throw new Error("Failed to fetch members");
  }

  // Fetch member display names
  const userIds = members.map((m) => m.user_id);
  const { data: profiles } = await admin
    .from("shared_profiles")
    .select("id, full_name, email")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name ?? p.email]),
  );

  // Get existing Nuki auths on this smartlock
  const existingAuths = await listAuths(config.nuki_api_token, config.nuki_smartlock_id);
  const existingCodes = new Set(existingAuths.map((a) => a.code));

  const activeStatuses = new Set(["active", "past_due", "cancelling", "paused"]);

  for (const member of members) {
    const plan = member.plans as unknown as { access_type: string };
    const accessType = plan.access_type;
    const isActive = activeStatuses.has(member.status) && accessType !== "none";
    const memberName = String(profileMap.get(member.user_id) ?? "Member");
    // Truncate to Nuki's 20-char limit
    const nukiName = memberName.slice(0, 20);

    try {
      if (isActive && !member.nuki_auth_id) {
        // Create new code
        const pin = generatePin(existingCodes);
        const restrictions = buildTimeRestrictions(accessType, businessHours);

        await createAuth(config.nuki_api_token, config.nuki_smartlock_id, {
          name: nukiName,
          code: pin,
          type: 13,
          ...restrictions,
          enabled: true,
          remoteAllowed: false,
        });

        // Look up the created auth to get its ID
        const updatedAuths = await listAuths(config.nuki_api_token, config.nuki_smartlock_id);
        const newAuth = updatedAuths.find((a) => a.code === pin);

        if (newAuth) {
          await admin
            .from("members")
            .update({
              nuki_auth_id: newAuth.id,
              access_code: String(pin),
            })
            .eq("id", member.id);

          existingCodes.add(pin);
          result.created++;
        }
      } else if (isActive && member.nuki_auth_id) {
        // Update existing code (access type may have changed)
        const restrictions = buildTimeRestrictions(accessType, businessHours);

        await updateAuth(
          config.nuki_api_token,
          config.nuki_smartlock_id,
          member.nuki_auth_id,
          { ...restrictions, enabled: true, name: nukiName },
        );

        result.updated++;
      } else if (!isActive && member.nuki_auth_id) {
        // Delete code for inactive member
        await deleteAuth(
          config.nuki_api_token,
          config.nuki_smartlock_id,
          member.nuki_auth_id,
        );

        await admin
          .from("members")
          .update({ nuki_auth_id: null, access_code: null })
          .eq("id", member.id);

        result.deleted++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      result.errors.push(`${nukiName}: ${msg}`);
    }
  }

  // Update sync timestamp
  await admin
    .from("space_access_config")
    .update({
      nuki_last_sync_at: new Date().toISOString(),
      nuki_sync_error: result.errors.length > 0 ? result.errors.join("; ") : null,
    })
    .eq("space_id", spaceId);

  return result;
}

/**
 * Delete a single member's Nuki keypad code.
 * Called when a subscription ends or member is churned.
 */
export async function deleteNukiCodeForMember(
  spaceId: string,
  memberId: string,
): Promise<void> {
  const admin = createAdminClient();

  const { data: config } = await admin
    .from("space_access_config")
    .select("nuki_api_token, nuki_smartlock_id, enabled, mode")
    .eq("space_id", spaceId)
    .single();

  if (!config?.enabled || config.mode !== "nuki" || !config.nuki_api_token || !config.nuki_smartlock_id) {
    return;
  }

  const { data: member } = await admin
    .from("members")
    .select("nuki_auth_id")
    .eq("id", memberId)
    .single();

  if (!member?.nuki_auth_id) return;

  try {
    await deleteAuth(config.nuki_api_token, config.nuki_smartlock_id, member.nuki_auth_id);
  } catch (err) {
    createLogger({ component: "nuki/sync", spaceId }).error("Failed to delete Nuki code", { memberId, error: err instanceof Error ? err.message : "Unknown error" });
  }

  await admin
    .from("members")
    .update({ nuki_auth_id: null, access_code: null })
    .eq("id", memberId);
}
