import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSpaceFromHostname } from "@/lib/space/resolve";
import { getOrigin } from "@/lib/url";

export async function GET(request: NextRequest) {
  const origin = getOrigin(request.headers);

  // 1. Get the authenticated user from the session cookie
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  // 2. Resolve space from hostname
  const hostname = request.headers.get("host") ?? "";
  const space = await resolveSpaceFromHostname(hostname);

  if (!space) {
    const platformDomain =
      process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "localhost:3000";
    const proto = request.headers.get("x-forwarded-proto") ?? "http";
    return NextResponse.redirect(`${proto}://${platformDomain}/spaces`);
  }

  // 3. Verify user is a member of this space
  const admin = createAdminClient();

  const { data: spaceUser } = await admin
    .from("space_users")
    .select("role")
    .eq("user_id", user.id)
    .eq("space_id", space.id)
    .single();

  if (!spaceUser) {
    return NextResponse.redirect(
      new URL("/login?error=not_a_member", origin)
    );
  }

  // 4. Update app_metadata to point to this space
  await admin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      space_id: space.id,
      tenant_id: space.tenantId,
      space_role: spaceUser.role,
    },
  });

  // 5. Refresh session to pick up new claims
  await supabase.auth.refreshSession();

  // 6. Redirect to dashboard (or the original requested path)
  const next = request.nextUrl.searchParams.get("next") ?? "/dashboard";
  return NextResponse.redirect(new URL(next, origin));
}
