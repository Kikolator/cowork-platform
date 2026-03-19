"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/auth/guard";

export async function addPlatformAdmin(email: string) {
  await requirePlatformAdmin();

  const db = createAdminClient();

  // Find user by email in shared_profiles
  const { data: profile } = await db
    .from("shared_profiles")
    .select("id")
    .eq("email", email.toLowerCase().trim())
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

  const db = createAdminClient();

  // Don't allow removing the last admin
  const { count } = await db
    .from("platform_admins")
    .select("*", { count: "exact", head: true });

  if ((count ?? 0) <= 1) {
    return { error: "Cannot remove the last platform admin." };
  }

  const { error } = await db
    .from("platform_admins")
    .delete()
    .eq("user_id", userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admins");
  return { error: null };
}
