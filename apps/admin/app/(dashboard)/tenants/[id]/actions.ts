"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/auth/guard";

export async function updateTenantStatus(tenantId: string, status: string) {
  await requirePlatformAdmin();

  const validStatuses = ["active", "trial", "suspended", "churned"] as const;
  if (!validStatuses.includes(status as (typeof validStatuses)[number])) {
    return { error: "Invalid status" };
  }

  const db = createAdminClient();
  const { error } = await db
    .from("tenants")
    .update({ status: status as (typeof validStatuses)[number] })
    .eq("id", tenantId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/tenants/${tenantId}`);
  revalidatePath("/tenants");
  revalidatePath("/");
  return { error: null };
}
