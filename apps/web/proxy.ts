import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  resolveSpaceFromHostname,
  resolveSpaceBySlug,
} from "@/lib/space/resolve";
import { getOrigin, isPlatformHost } from "@/lib/url";

const SPACE_PUBLIC_PATHS = new Set(["/login", "/auth/callback"]);
const PLATFORM_PUBLIC_PATHS = new Set(["/login", "/auth/callback", "/"]);

function redirectTo(request: NextRequest, path: string, spaceSlug?: string) {
  const url = new URL(path, getOrigin(request.headers));
  // On preview deployments, preserve ?space= across redirects
  if (spaceSlug) {
    url.searchParams.set("space", spaceSlug);
  }
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;

  // Skip static assets and internal Next.js routes
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/manifest.json") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Let health-check and webhook endpoints through without auth or space resolution
  if (pathname === "/api/health" || pathname.startsWith("/api/webhooks/")) {
    return NextResponse.next();
  }

  // Resolve space from subdomain (returns null for bare platform domain)
  let space = await resolveSpaceFromHostname(hostname);

  // On preview deployments, fall back to ?space= query param
  const spaceSlugParam = request.nextUrl.searchParams.get("space");
  const isPreview = !isPlatformHost(hostname);
  if (!space && isPreview && spaceSlugParam) {
    space = await resolveSpaceBySlug(spaceSlugParam);
  }

  // Slug to preserve across redirects on preview
  const preserveSlug = isPreview ? (space?.slug ?? spaceSlugParam ?? undefined) : undefined;

  // Refresh Supabase session
  const { response, user } = await updateSession(request);

  if (space) {
    // === Space mode (subdomain or ?space= param) ===
    response.headers.set("x-space-id", space.id);
    response.headers.set("x-space-slug", space.slug);
    response.headers.set("x-space-tenant-id", space.tenantId);
    response.headers.set("x-space-name", space.name);

    if (SPACE_PUBLIC_PATHS.has(pathname) || pathname.startsWith("/auth/")) {
      if (pathname === "/login" && user) {
        return redirectTo(request, "/dashboard", preserveSlug);
      }
      return response;
    }

    if (!user) {
      return redirectTo(request, "/login", preserveSlug);
    }

    // If user's app_metadata doesn't match this space, redirect through
    // the claim-setting route so Server Actions and RLS work correctly.
    const currentSpaceId = user.app_metadata?.space_id as string | undefined;
    if (currentSpaceId !== space.id && pathname !== "/auth/set-space") {
      return redirectTo(request, "/auth/set-space", preserveSlug);
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
