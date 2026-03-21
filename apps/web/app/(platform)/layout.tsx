import { SignOutButton } from "./sign-out-button";
import { createClient } from "@/lib/supabase/server";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="glass-gradient-bg flex min-h-screen flex-col items-center justify-center px-4">
      {user && (
        <div className="fixed top-4 right-4">
          <SignOutButton />
        </div>
      )}
      <div className="w-full max-w-lg space-y-8">
        <div className="flex flex-col items-center gap-3">
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
          <p className="text-sm text-muted-foreground">
            Launch your space
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-heavy)] p-8 shadow-[var(--glass-shadow)] backdrop-blur-xl">
          {children}
        </div>
      </div>
    </div>
  );
}
