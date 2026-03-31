import { NextResponse, type NextRequest } from "next/server";
import { createLogger } from "@cowork/shared";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    "localhost:3001";
  const origin = `${proto}://${host}`;

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    createLogger({ component: "admin/auth/callback" }).error("exchangeCodeForSession failed", { error: error.message });
    return NextResponse.redirect(new URL("/login?error=auth_failed", origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?error=auth_failed", origin));
  }

  // Verify platform admin access
  const admin = createAdminClient();
  const { data: platformAdmin } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .single();

  if (!platformAdmin) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=not_admin", origin));
  }

  // Track last login
  await admin
    .from("shared_profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", user.id);

  return NextResponse.redirect(new URL("/", origin));
}
