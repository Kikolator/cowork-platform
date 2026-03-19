import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import type { Database } from "@cowork/db";
import { getCookieOptions } from "./cookies";

export async function createClient() {
  const cookieStore = await cookies();
  const headersList = await headers();
  const hostname =
    headersList.get("x-forwarded-host") ??
    headersList.get("host") ??
    "localhost";
  const cookieOpts = getCookieOptions(hostname);

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUB_KEY!,
    {
      cookieOptions: cookieOpts,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, { ...options, ...cookieOpts })
          );
        },
      },
    }
  );
}
