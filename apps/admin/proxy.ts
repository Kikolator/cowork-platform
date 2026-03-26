import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = new Set(["/login", "/auth/callback", "/denied"]);

// Auth layer 1: proxy checks authentication (is logged in?).
// Auth layer 2: (dashboard)/layout.tsx calls requirePlatformAdmin() to
// verify the user is in platform_admins. All protected routes MUST live
// under the (dashboard) route group.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets and internal Next.js routes
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);

  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith("/auth/")) {
    // Don't auto-redirect from /login if user explicitly navigated there
    // (e.g. from /denied to switch accounts)
    if (pathname === "/login" && user && !request.nextUrl.searchParams.has("switch")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return response;
  }

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}
