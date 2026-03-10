import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

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

  const headersList = await headers();
  const spaceName = headersList.get("x-space-name") ?? "RogueOps";
  const spaceRole =
    (user.app_metadata?.space_role as string | undefined) ?? "member";

  // Fetch space branding
  const spaceId = headersList.get("x-space-id");
  let logoUrl: string | null = null;
  let primaryColor = "#000000";
  let accentColor = "#3b82f6";

  if (spaceId) {
    const { data: space } = await supabase
      .from("spaces")
      .select("logo_url, primary_color, accent_color")
      .eq("id", spaceId)
      .single();

    if (space) {
      logoUrl = space.logo_url;
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
        } as React.CSSProperties
      }
    >
      {/* Sidebar — hidden on mobile, shown on lg+ */}
      <div className="hidden lg:block">
        <Sidebar
          spaceRole={spaceRole}
          spaceName={spaceName}
          logoUrl={logoUrl}
        />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          spaceName={spaceName}
          logoUrl={logoUrl}
          userEmail={user.email ?? ""}
          spaceRole={spaceRole}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
