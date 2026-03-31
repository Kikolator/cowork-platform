import { NextResponse, type NextRequest } from "next/server";
import { createLogger } from "@cowork/shared";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSpaceFromHostname } from "@/lib/space/resolve";
import { getOrigin } from "@/lib/url";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const origin = getOrigin(request.headers);

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", origin));
  }

  // 1. Exchange code for session
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    createLogger({ component: "auth/callback" }).error("exchangeCodeForSession failed", { error: error.message, status: error.status });
    return NextResponse.redirect(
      new URL("/login?error=auth_failed", origin)
    );
  }

  // 2. Get the authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?error=no_user", origin));
  }

  // 3. Resolve space from hostname
  const hostname = request.headers.get("host") ?? "";
  const space = await resolveSpaceFromHostname(hostname);

  if (!space) {
    // Platform domain login (no space context) — redirect to spaces list
    return NextResponse.redirect(new URL("/spaces", origin));
  }

  // 4. Space domain login — check/create space_users and set claims
  const next = searchParams.get("next") ?? "/dashboard";
  const admin = createAdminClient();

  const { data: existingSpaceUser } = await admin
    .from("space_users")
    .select("id, role")
    .eq("user_id", user.id)
    .eq("space_id", space.id)
    .single();

  let role: string;

  if (existingSpaceUser) {
    role = existingSpaceUser.role;
  } else {
    const { data: spaceData } = await admin
      .from("spaces")
      .select("features")
      .eq("id", space.id)
      .single();

    const features = spaceData?.features as Record<string, boolean> | null;
    const openRegistration = features?.open_registration ?? false;

    if (!openRegistration) {
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL("/login?error=not_invited", origin)
      );
    }

    const { error: insertError } = await admin
      .from("space_users")
      .insert({ user_id: user.id, space_id: space.id, role: "member" });

    if (insertError) {
      return NextResponse.redirect(
        new URL("/login?error=registration_failed", origin)
      );
    }

    role = "member";
  }

  // 5. Set JWT claims
  const { error: updateError } = await admin.auth.admin.updateUserById(
    user.id,
    {
      app_metadata: {
        space_id: space.id,
        tenant_id: space.tenantId,
        space_role: role,
      },
    }
  );

  if (updateError) {
    return NextResponse.redirect(
      new URL("/login?error=claims_failed", origin)
    );
  }

  // 5b. Track last login
  await admin
    .from("shared_profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", user.id);

  // 6. Refresh session to pick up new claims
  await supabase.auth.refreshSession();

  return NextResponse.redirect(new URL(next, origin));
}
