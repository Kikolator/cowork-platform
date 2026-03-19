import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const errorCode = typeof params.error === "string" ? params.error : null;

  const errorMessages: Record<string, string> = {
    no_code: "Invalid login link. Please try again.",
    auth_failed: "Authentication failed. Please try again.",
    not_admin: "You do not have platform admin access.",
  };

  const errorMessage = errorCode ? errorMessages[errorCode] : null;

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            RogueOps Admin
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Platform administration
          </p>
        </div>
        {errorMessage && (
          <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300">
            {errorMessage}
          </div>
        )}
        <LoginForm />
      </div>
    </div>
  );
}
