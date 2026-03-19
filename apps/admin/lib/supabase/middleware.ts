import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { Database } from "@cowork/db";
import { getCookieOptions } from "./cookies";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const hostname =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    "localhost";
  const cookieOpts = getCookieOptions(hostname);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUB_KEY!,
    {
      cookieOptions: cookieOpts,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, { ...options, ...cookieOpts })
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
