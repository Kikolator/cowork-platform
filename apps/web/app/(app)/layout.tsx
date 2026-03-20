import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { hexToOklch, contrastForeground } from "@/lib/color";

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const spaceName = headersList.get("x-space-name");
  return {
    title: spaceName ?? undefined,
  };
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user profile avatar
  const { data: profile } = await supabase
    .from("shared_profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .single();

  const headersList = await headers();
  const spaceName = headersList.get("x-space-name") ?? "RogueOps";
  const spaceRole =
    (user.app_metadata?.space_role as string | undefined) ?? "member";

  // Fetch space branding
  const spaceId = headersList.get("x-space-id");
  let logoUrl: string | null = null;
  let logoDarkUrl: string | null = null;
  let primaryColor = "#000000";
  let accentColor = "#3b82f6";

  if (spaceId) {
    const { data: space } = await supabase
      .from("spaces")
      .select("logo_url, logo_dark_url, primary_color, accent_color")
      .eq("id", spaceId)
      .single();

    if (space) {
      logoUrl = space.logo_url;
      logoDarkUrl = space.logo_dark_url;
      primaryColor = space.primary_color ?? primaryColor;
      accentColor = space.accent_color ?? accentColor;
    }
  }

  return (
    <div
      className="glass-gradient-bg flex h-screen overflow-hidden"
      style={
        {
          "--brand-primary": primaryColor,
          "--brand-accent": accentColor,
          "--primary": hexToOklch(primaryColor),
          "--primary-foreground": contrastForeground(primaryColor),
          "--sidebar-primary": hexToOklch(primaryColor),
          "--sidebar-primary-foreground": contrastForeground(primaryColor),
          "--accent": hexToOklch(accentColor),
          "--accent-foreground": contrastForeground(accentColor),
          "--ring": hexToOklch(primaryColor),
        } as React.CSSProperties
      }
    >
      {/* Sidebar — hidden on mobile, shown on lg+ */}
      <div className="hidden lg:block">
        <Sidebar
          spaceRole={spaceRole}
          spaceName={spaceName}
          logoUrl={logoUrl}
          logoDarkUrl={logoDarkUrl}
        />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          spaceName={spaceName}
          logoUrl={logoUrl}
          logoDarkUrl={logoDarkUrl}
          userEmail={user.email ?? ""}
          spaceRole={spaceRole}
          userAvatarUrl={profile?.avatar_url ?? null}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
