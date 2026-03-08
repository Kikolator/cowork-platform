"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  initiateStripeConnect,
  checkStripeStatus,
  disconnectStripe,
} from "./actions";

interface StripeConnectProps {
  stripeAccountId: string | null;
  stripeOnboardingComplete: boolean;
  platformFeePercent: string;
}

export function StripeConnect({
  stripeAccountId,
  stripeOnboardingComplete,
  platformFeePercent,
}: StripeConnectProps) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{
    connected: boolean;
    accountId: string | null;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    onboardingComplete: boolean;
  }>({
    connected: !!stripeAccountId,
    accountId: stripeAccountId,
    chargesEnabled: stripeOnboardingComplete,
    payoutsEnabled: stripeOnboardingComplete,
    detailsSubmitted: stripeOnboardingComplete,
    onboardingComplete: stripeOnboardingComplete,
  });

  const refreshStatus = useCallback(async () => {
    const result = await checkStripeStatus();
    if (result.connected) {
      setStatus({
        connected: true,
        accountId: result.accountId ?? null,
        chargesEnabled: result.chargesEnabled ?? false,
        payoutsEnabled: result.payoutsEnabled ?? false,
        detailsSubmitted: result.detailsSubmitted ?? false,
        onboardingComplete: result.onboardingComplete ?? false,
      });
    } else {
      setStatus({
        connected: false,
        accountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        onboardingComplete: false,
      });
    }
  }, []);

  // Handle return from Stripe onboarding
  useEffect(() => {
    const stripeParam = searchParams.get("stripe");
    if (stripeParam === "complete" || stripeParam === "refresh") {
      refreshStatus();
    }
  }, [searchParams, refreshStatus]);

  async function handleConnect() {
    setLoading(true);
    setError(null);
    try {
      const result = await initiateStripeConnect();
      if (!result.success) {
        setError(result.error);
        return;
      }
      // Redirect to Stripe's hosted onboarding
      window.location.href = result.url;
    } catch {
      setError("Failed to initiate Stripe Connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    setError(null);
    try {
      const result = await disconnectStripe();
      if (!result.success) {
        setError(result.error);
        return;
      }
      setStatus({
        connected: false,
        accountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        onboardingComplete: false,
      });
    } catch {
      setError("Failed to disconnect Stripe. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function maskAccountId(id: string) {
    if (id.length <= 10) return id;
    return `${id.slice(0, 10)}...${id.slice(-4)}`;
  }

  const stripeParam = searchParams.get("stripe");
  const showRefreshMessage = stripeParam === "refresh";

  // State: Not connected
  if (!status.connected) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Stripe Payments
        </h3>

        {showRefreshMessage && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Your Stripe onboarding link expired. Click below to try again.
          </div>
        )}

        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Connect your Stripe account to start accepting payments from members.
        </p>

        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <Button
          onClick={handleConnect}
          disabled={loading}
          className="mt-4"
        >
          {loading ? "Connecting..." : "Connect Stripe Account"}
        </Button>

        <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
          You'll be redirected to Stripe to complete setup. Stripe handles all
          payment processing, payouts, and compliance.
        </p>
      </div>
    );
  }

  // State: Onboarding incomplete
  if (!status.onboardingComplete) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Stripe Payments
        </h3>

        <div className="mt-3 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          Stripe setup incomplete
        </div>

        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Your account is connected but onboarding isn't finished. Payments
          cannot be processed yet.
        </p>

        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="mt-4 flex gap-3">
          <Button onClick={handleConnect} disabled={loading}>
            {loading ? "Connecting..." : "Complete Stripe Setup"}
          </Button>
          <DisconnectButton loading={loading} onDisconnect={handleDisconnect} />
        </div>
      </div>
    );
  }

  // State: Fully connected
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
        Stripe Payments
      </h3>

      <div className="mt-3 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
        Connected
      </div>

      <div className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
        {status.accountId && (
          <p>
            Account:{" "}
            <span className="font-mono text-xs">
              {maskAccountId(status.accountId)}
            </span>
          </p>
        )}
        <p>
          Charges:{" "}
          <StatusIndicator enabled={status.chargesEnabled} label="Enabled" />
        </p>
        <p>
          Payouts:{" "}
          <StatusIndicator enabled={status.payoutsEnabled} label="Enabled" />
        </p>
      </div>

      <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
        Platform fee:{" "}
        {platformFeePercent}% per
        transaction
      </p>

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="mt-4 flex gap-3">
        <a
          href="https://dashboard.stripe.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline">Open Stripe Dashboard</Button>
        </a>
        <DisconnectButton loading={loading} onDisconnect={handleDisconnect} />
      </div>
    </div>
  );
}

function StatusIndicator({
  enabled,
  label,
}: {
  enabled: boolean;
  label: string;
}) {
  if (enabled) {
    return <span className="text-green-600 dark:text-green-400">{label}</span>;
  }
  return <span className="text-red-600 dark:text-red-400">Disabled</span>;
}

function DisconnectButton({
  loading,
  onDisconnect,
}: {
  loading: boolean;
  onDisconnect: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant="outline" disabled={loading} />}
      >
        Disconnect
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect Stripe?</AlertDialogTitle>
          <AlertDialogDescription>
            This will prevent all payments. Active subscriptions will fail.
            Members won't be able to make purchases until you reconnect.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onDisconnect}>
            Disconnect
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
