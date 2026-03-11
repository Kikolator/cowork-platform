"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getOrigin } from "@/lib/url";

export async function sendMagicLink(email: string) {
  const supabase = await createClient();
  const headersList = await headers();
  const origin = getOrigin(headersList);

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}
