import type { Metadata } from "next";
import { headers } from "next/headers";

async function getSpaceName() {
  const headersList = await headers();
  return headersList.get("x-space-name");
}

export async function generateMetadata(): Promise<Metadata> {
  const spaceName = await getSpaceName();
  return {
    title: spaceName ? `Checkout | ${spaceName}` : "Checkout",
  };
}

export default async function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const spaceName = await getSpaceName();

  return (
    <div className="glass-gradient-bg flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-center">
          {spaceName && (
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {spaceName}
            </h1>
          )}
        </div>
        <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-heavy)] p-8 shadow-[var(--glass-shadow)] backdrop-blur-xl">
          {children}
        </div>
      </div>
    </div>
  );
}
