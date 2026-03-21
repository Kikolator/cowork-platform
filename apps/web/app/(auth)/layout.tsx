import type { Metadata } from "next";
import { headers } from "next/headers";

async function getSpaceName() {
  const headersList = await headers();
  return headersList.get("x-space-name");
}

export async function generateMetadata(): Promise<Metadata> {
  const spaceName = await getSpaceName();
  return {
    title: spaceName && spaceName !== "RogueOps" ? `${spaceName} | RogueOps` : "RogueOps",
  };
}

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const spaceName = await getSpaceName();

  return (
    <div className="glass-gradient-bg flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-center">
          {spaceName ? (
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {spaceName}
            </h1>
          ) : (
            <>
              <img
                src="/ai-compound-light.svg"
                alt="RogueOps"
                className="h-10 dark:hidden"
              />
              <img
                src="/ai-compound-dark.svg"
                alt="RogueOps"
                className="hidden h-10 dark:block"
              />
            </>
          )}
        </div>
        <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-heavy)] p-8 shadow-[var(--glass-shadow)] backdrop-blur-xl">
          {children}
        </div>
      </div>
    </div>
  );
}
