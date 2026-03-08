import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@cowork/db";
import { cookieOptions } from "./cookies";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions }
  );
}
