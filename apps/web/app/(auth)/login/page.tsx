import { headers } from "next/headers";
import { LoginForm } from "./login-form";

const ERROR_MESSAGES: Record<string, string> = {
  no_code: "Invalid login link. Please try again.",
  auth_failed: "Authentication failed. Please try again.",
  no_space: "This workspace could not be found.",
  not_invited:
    "You don't have access to this workspace. Contact the administrator.",
  registration_failed: "Something went wrong. Please try again.",
  claims_failed: "Something went wrong. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const headersList = await headers();
  const spaceName = headersList.get("x-space-name") ?? "this workspace";
  const params = await searchParams;
  const errorCode = typeof params.error === "string" ? params.error : null;
  const errorMessage = errorCode ? ERROR_MESSAGES[errorCode] : null;

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-700 backdrop-blur-sm dark:text-red-300">
          {errorMessage}
        </div>
      )}
      <LoginForm spaceName={spaceName} />
    </div>
  );
}
