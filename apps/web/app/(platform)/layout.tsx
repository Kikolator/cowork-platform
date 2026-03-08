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
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      {user && (
        <div className="fixed top-4 right-4">
          <SignOutButton />
        </div>
      )}
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Cowork
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Launch your coworking space
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
