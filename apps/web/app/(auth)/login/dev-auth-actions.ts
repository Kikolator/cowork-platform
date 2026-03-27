"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSpaceFromHostname } from "@/lib/space/resolve";

type DevAuthResult = {
  error: string | null;
  redirectTo?: string;
  message?: string;
};

/**
 * After password sign-in/sign-up, resolve the current space and set JWT claims
 * (mirrors the logic in /auth/callback for magic-link flow).
 */
async function setupSpaceClaims(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<DevAuthResult> {
  const headersList = await headers();
  const hostname = headersList.get("host") ?? "";
  const space = await resolveSpaceFromHostname(hostname);

  if (!space) {
    return { error: null, redirectTo: "/spaces" };
  }

  const admin = createAdminClient();

  const { data: existingSpaceUser } = await admin
    .from("space_users")
    .select("id, role")
    .eq("user_id", userId)
    .eq("space_id", space.id)
    .single();

  let role: string;

  if (existingSpaceUser) {
    role = existingSpaceUser.role;
  } else {
    const { data: spaceData } = await admin
      .from("spaces")
      .select("features")
      .eq("id", space.id)
      .single();

    const features = spaceData?.features as Record<string, boolean> | null;
    const openRegistration = features?.open_registration ?? false;

    if (!openRegistration) {
      await supabase.auth.signOut();
      return { error: "Not invited to this space" };
    }

    const { error: insertError } = await admin
      .from("space_users")
      .insert({ user_id: userId, space_id: space.id, role: "member" });

    if (insertError) {
      return { error: "Registration failed" };
    }

    role = "member";
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(
    userId,
    {
      app_metadata: {
        space_id: space.id,
        tenant_id: space.tenantId,
        space_role: role,
      },
    },
  );

  if (updateError) {
    return { error: "Failed to set claims" };
  }

  await admin
    .from("shared_profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", userId);

  await supabase.auth.refreshSession();

  return { error: null, redirectTo: "/dashboard" };
}

export async function signInWithDevPassword(
  email: string,
  password: string,
): Promise<DevAuthResult> {
  if (process.env.NEXT_PUBLIC_APP_ENV !== "development") {
    return { error: "Dev auth is not enabled" };
  }

  const supabase = await createClient();
  const { error, data } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  return setupSpaceClaims(supabase, data.user.id);
}

export async function signUpWithDevPassword(
  email: string,
  password: string,
): Promise<DevAuthResult> {
  if (process.env.NEXT_PUBLIC_APP_ENV !== "development") {
    return { error: "Dev auth is not enabled" };
  }

  const supabase = await createClient();
  const { error, data } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.user) {
    return { error: "Sign up failed" };
  }

  if (!data.session) {
    return {
      error: null,
      message: "Check your email to confirm your account",
    };
  }

  return setupSpaceClaims(supabase, data.user.id);
}
