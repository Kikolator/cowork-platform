"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/auth/guard";

const uuidSchema = z.string().uuid();
const tenantStatusSchema = z.enum(["active", "trial", "suspended", "churned"]);

export async function updateTenantStatus(tenantId: string, status: string) {
  await requirePlatformAdmin();

  const parsedId = uuidSchema.safeParse(tenantId);
  if (!parsedId.success) {
    return { error: "Invalid tenant ID" };
  }
  const parsedStatus = tenantStatusSchema.safeParse(status);
  if (!parsedStatus.success) {
    return { error: "Invalid status" };
  }

  const db = createAdminClient();
  const { error } = await db
    .from("tenants")
    .update({ status: parsedStatus.data })
    .eq("id", parsedId.data);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/tenants/${parsedId.data}`);
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

  const parsedId = uuidSchema.safeParse(tenantId);
  if (!parsedId.success) {
    return { error: "Invalid tenant ID" };
  }
  const parsed = feeSchema.safeParse(feePercent);
  if (!parsed.success) {
    return { error: "Fee must be an integer between 0 and 50" };
  }

  const db = createAdminClient();
  const { error } = await db
    .from("tenants")
    .update({ platform_fee_percent: parsed.data })
    .eq("id", parsedId.data);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/tenants/${parsedId.data}`);
  return { error: null };
}
