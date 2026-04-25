"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { listSmartlocks } from "@/lib/nuki/client";
import { syncNukiCodes } from "@/lib/nuki/sync";
import { accessConfigSchema } from "./access-schemas";

async function getSpaceId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const spaceId = user.app_metadata?.space_id as string | undefined;
  if (!spaceId) throw new Error("No space context");
  return { supabase, user, spaceId };
}

export async function updateAccessConfig(input: unknown) {
  const parsed = accessConfigSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, spaceId } = await getSpaceId();
  const d = parsed.data;

  // Includes wifi columns from pass_product_config migration — not yet in generated types.
  const row = {
    space_id: spaceId,
    enabled: d.enabled,
    mode: d.mode,
    code_business_hours: d.codeBusinessHours || null,
    code_extended: d.codeExtended || null,
    code_twenty_four_seven: d.codeTwentyFourSeven || null,
    nuki_api_token: d.nukiApiToken || null,
    nuki_smartlock_id: d.nukiSmartlockId || null,
  };
  Object.assign(row, {
    wifi_network: d.wifiNetwork || null,
    wifi_password: d.wifiPassword || null,
  });

  const { error } = await supabase
    .from("space_access_config")
    .upsert(row, { onConflict: "space_id" });

  if (error) return { success: false as const, error: error.message };

  revalidatePath("/admin/settings");
  revalidatePath("/access");
  return { success: true as const };
}

export async function fetchNukiSmartlocks(apiToken: string) {
  await getSpaceId(); // Verify caller is authenticated with space context

  try {
    const locks = await listSmartlocks(apiToken);
    return {
      success: true as const,
      smartlocks: locks.map((l) => ({
        id: String(l.smartlockId),
        name: l.name,
      })),
    };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Failed to connect to Nuki",
    };
  }
}

export async function triggerNukiSync() {
  const { spaceId } = await getSpaceId();

  try {
    const result = await syncNukiCodes(spaceId);
    revalidatePath("/admin/settings");
    revalidatePath("/admin/members");
    revalidatePath("/access");
    return {
      success: true as const,
      created: result.created,
      updated: result.updated,
      deleted: result.deleted,
      errors: result.errors,
    };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Sync failed",
    };
  }
}
