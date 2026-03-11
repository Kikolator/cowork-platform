import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@cowork/db";
import { getCookieOptions } from "./cookies";

export function createClient() {
  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "localhost";

  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUB_KEY!,
    { cookieOptions: getCookieOptions(hostname) }
  );
}
