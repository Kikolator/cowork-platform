import type { Metadata } from "next";
import { headers } from "next/headers";
import { RogueOpsLogo } from "@/components/rogueops-logo";

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const spaceName = headersList.get("x-space-name");
  const faviconUrl = headersList.get("x-space-favicon-url");
  return {
    title: spaceName && spaceName !== "RogueOps" ? `${spaceName} | RogueOps` : "RogueOps",
    ...(faviconUrl && { icons: { icon: faviconUrl } }),
  };
}

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const spaceName = headersList.get("x-space-name");

  return (
    <div className="glass-gradient-bg flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-center">
          {spaceName ? (
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {spaceName}
            </h1>
          ) : (
            <RogueOpsLogo className="h-10" />
          )}
        </div>
        <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-heavy)] p-8 shadow-[var(--glass-shadow)] backdrop-blur-xl">
          {children}
        </div>
      </div>
    </div>
  );
}
