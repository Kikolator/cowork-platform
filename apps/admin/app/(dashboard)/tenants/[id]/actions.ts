"use server";

import { z } from "zod";
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

const feeSchema = z.number().int().min(0).max(50).nullable();

export async function updatePlatformFee(
  tenantId: string,
  feePercent: number | null,
) {
  await requirePlatformAdmin();

  const parsed = feeSchema.safeParse(feePercent);
  if (!parsed.success) {
    return { error: "Fee must be an integer between 0 and 50" };
  }

  const db = createAdminClient();
  const { error } = await db
    .from("tenants")
    .update({ platform_fee_percent: parsed.data })
    .eq("id", tenantId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/tenants/${tenantId}`);
  return { error: null };
}
