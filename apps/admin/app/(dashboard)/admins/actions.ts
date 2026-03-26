"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/auth/guard";

const emailSchema = z.string().email().max(320);
const uuidSchema = z.string().uuid();

export async function addPlatformAdmin(email: string) {
  await requirePlatformAdmin();

  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    return { error: "Invalid email address" };
  }

  const db = createAdminClient();

  // Find user by email in shared_profiles
  const { data: profile } = await db
    .from("shared_profiles")
    .select("id")
    .eq("email", parsed.data.toLowerCase().trim())
    .single();

  if (!profile) {
    return { error: "No user found with that email. They must have logged in at least once." };
  }

  // Check if already an admin
  const { data: existing } = await db
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", profile.id)
    .single();

  if (existing) {
    return { error: "This user is already a platform admin." };
  }

  const { error } = await db
    .from("platform_admins")
    .insert({ user_id: profile.id });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admins");
  return { error: null };
}

export async function removePlatformAdmin(userId: string) {
  await requirePlatformAdmin();

  const parsedId = uuidSchema.safeParse(userId);
  if (!parsedId.success) {
    return { error: "Invalid user ID" };
  }

  const db = createAdminClient();

  // Atomic: delete only if more than one admin remains
  const { data: removed, error } = await db
    .rpc("remove_platform_admin", { p_user_id: parsedId.data });

  if (error) {
    return { error: error.message };
  }
  if (!removed) {
    return { error: "Cannot remove the last platform admin." };
  }

  revalidatePath("/admins");
  return { error: null };
}
