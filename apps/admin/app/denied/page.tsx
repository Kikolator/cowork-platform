import Link from "next/link";

export default function DeniedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 px-4 text-center">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Access Denied
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You do not have platform admin privileges. Contact an administrator
            if you believe this is an error.
          </p>
        </div>
        <Link
          href="/login?switch"
          className="inline-block rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Sign in with a different account
        </Link>
      </div>
    </div>
  );
}
