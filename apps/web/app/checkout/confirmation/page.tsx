import { headers } from "next/headers";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { ResendButton } from "../_components/resend-button";

interface ConfirmationPageProps {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function ConfirmationPage({
  searchParams,
}: ConfirmationPageProps) {
  const { session_id: sessionId } = await searchParams;
  const headersList = await headers();
  const spaceId = headersList.get("x-space-id");
  const spaceName = headersList.get("x-space-name");

  if (!sessionId || !spaceId) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Invalid confirmation link.
      </p>
    );
  }

  // Look up connected account for this space
  const admin = createAdminClient();
  const { data: space } = await admin
    .from("spaces")
    .select("tenant_id")
    .eq("id", spaceId)
    .single();

  if (!space) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Space not found.
      </p>
    );
  }

  const { data: tenant } = await admin
    .from("tenants")
    .select("stripe_account_id")
    .eq("id", space.tenant_id)
    .single();

  if (!tenant?.stripe_account_id) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Unable to retrieve purchase details.
      </p>
    );
  }

  // Retrieve Stripe session to get purchase info
  let email: string | null = null;
  let purchaseType: string | null = null;
  let purchaseSummary: string;

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId, {
      stripeAccount: tenant.stripe_account_id,
    });

    email = session.customer_email ?? session.customer_details?.email ?? null;
    purchaseType = session.metadata?.type ?? null;

    if (purchaseType === "daypass" || purchaseType === "product") {
      purchaseSummary = "Pass";
    } else if (purchaseType === "membership") {
      purchaseSummary = "Membership";
    } else {
      purchaseSummary = "Purchase";
    }
  } catch {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Unable to retrieve purchase details. If you completed payment, check
        your email for a login link.
      </p>
    );
  }

  return (
    <div className="space-y-6 text-center">
      <div className="space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-6 w-6 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          {purchaseSummary} Confirmed
        </h2>
        {spaceName && (
          <p className="text-sm text-muted-foreground">at {spaceName}</p>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          We&apos;ve sent a magic link to
        </p>
        {email && (
          <p className="font-medium text-foreground">{email}</p>
        )}
        <p className="text-sm text-muted-foreground">
          Click the link in your email to access your account. Your{" "}
          {purchaseType === "membership" ? "membership" : "pass"} is already
          active.
        </p>
      </div>

      <div className="space-y-3">
        <ResendButton sessionId={sessionId} />
        <Link
          href="/"
          className="block text-sm text-muted-foreground underline hover:text-foreground"
        >
          Return to homepage
        </Link>
      </div>
    </div>
  );
}
