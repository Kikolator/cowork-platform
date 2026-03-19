import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = new Set(["/login", "/auth/callback", "/denied"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
