"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type DevAuthResult = {
  error: string | null;
  redirectTo?: string;
  message?: string;
};

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

  // Verify platform admin access
  const admin = createAdminClient();
  const { data: platformAdmin } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", data.user.id)
    .single();

  if (!platformAdmin) {
    await supabase.auth.signOut();
    return { error: "Not a platform admin" };
  }

  // Track last login
  await admin
    .from("shared_profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", data.user.id);

  return { error: null, redirectTo: "/" };
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

  // Verify platform admin access
  const admin = createAdminClient();
  const { data: platformAdmin } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", data.user.id)
    .single();

  if (!platformAdmin) {
    await supabase.auth.signOut();
    return { error: "Not a platform admin" };
  }

  // Track last login
  await admin
    .from("shared_profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", data.user.id);

  return { error: null, redirectTo: "/" };
}
