import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { resolveSpaceFromHostname } from "@/lib/space/resolve";

const SPACE_PUBLIC_PATHS = new Set(["/login", "/auth/callback"]);
const PLATFORM_PUBLIC_PATHS = new Set(["/login", "/auth/callback", "/"]);

function redirectTo(request: NextRequest, path: string) {
  const host = request.headers.get("host") ?? "localhost:3000";
  const protocol = process.env.NEXT_PUBLIC_PROTOCOL ?? "http";
  return NextResponse.redirect(new URL(path, `${protocol}://${host}`));
}

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;

  // Resolve space (returns null for bare platform domain)
  const space = await resolveSpaceFromHostname(hostname);

  // Refresh Supabase session
  const { response, user } = await updateSession(request);

  if (space) {
    // === Space mode (subdomain) ===
    response.headers.set("x-space-id", space.id);
    response.headers.set("x-space-slug", space.slug);
    response.headers.set("x-space-tenant-id", space.tenantId);
    response.headers.set("x-space-name", space.name);

    if (SPACE_PUBLIC_PATHS.has(pathname) || pathname.startsWith("/auth/")) {
      if (pathname === "/login" && user) {
        return redirectTo(request, "/dashboard");
      }
      return response;
    }

    if (!user) {
      return redirectTo(request, "/login");
    }

    // If user's app_metadata doesn't match this space, redirect through
    // the claim-setting route so Server Actions and RLS work correctly.
    const currentSpaceId = user.app_metadata?.space_id as string | undefined;
    if (currentSpaceId !== space.id && pathname !== "/auth/set-space") {
      return redirectTo(request, "/auth/set-space");
    }

    return response;
  }

  // === Platform mode (bare domain, no subdomain) ===
  response.headers.set("x-platform-mode", "true");

  if (PLATFORM_PUBLIC_PATHS.has(pathname) || pathname.startsWith("/auth/")) {
    if (pathname === "/login" && user) {
      return redirectTo(request, "/spaces");
    }
    return response;
  }

  // /onboard and other platform routes require auth
  if (!user) {
    return redirectTo(request, "/login");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
