"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { cancelSubscription, resumeSubscription } from "./actions";

interface CurrentPlanProps {
  member: {
    id: string;
    status: string;
    plan_id: string;
    stripe_subscription_id: string | null;
    cancel_requested_at: string | null;
  };
  plan: {
    id: string;
    name: string;
    price_cents: number;
    currency: string;
  };
  creditBalances: Array<{
    resource_type_id: string;
    total_minutes: number;
    used_minutes: number;
    remaining_minutes: number;
    is_unlimited: boolean;
  }>;
  resourceTypeNames: Record<string, string>;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Active", variant: "default" },
  cancelling: { label: "Cancelling", variant: "outline" },
  past_due: { label: "Past Due", variant: "destructive" },
  paused: { label: "Paused", variant: "secondary" },
};

function formatMinutesToDisplay(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

function formatPrice(cents: number, currency: string): string {
  const amount = cents / 100;
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
  });
  return formatter.format(amount);
}

export function CurrentPlan({ member, plan, creditBalances, resourceTypeNames }: CurrentPlanProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const statusConfig = STATUS_CONFIG[member.status] ?? { label: member.status, variant: "outline" as const };

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelSubscription();
      if (!result.success) {
        setError(result.error);
      }
      setCancelDialogOpen(false);
    });
  }

  function handleResume() {
    startTransition(async () => {
      const result = await resumeSubscription();
      if (!result.success) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Your Plan: {plan.name}</h2>
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {formatPrice(plan.price_cents, plan.currency)}/month
          </p>
        </div>
      </div>

      {member.status === "cancelling" && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Your subscription is scheduled to cancel at the end of the current billing period.
          You will retain access until then.
        </div>
      )}

      {creditBalances.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-medium text-zinc-500">Credits this month</h3>
          <div className="space-y-3">
            {creditBalances.map((balance) => {
              if (balance.is_unlimited) {
                return (
                  <div key={balance.resource_type_id} className="flex items-center justify-between text-sm">
                    <span>{resourceTypeNames[balance.resource_type_id] ?? "Credits"}</span>
                    <span className="font-medium text-zinc-500">Unlimited</span>
                  </div>
                );
              }

              const percentage = balance.total_minutes > 0
                ? Math.round((balance.remaining_minutes / balance.total_minutes) * 100)
                : 0;

              return (
                <div key={balance.resource_type_id}>
                  <div className="flex items-center justify-between text-sm">
                    <span>{resourceTypeNames[balance.resource_type_id] ?? "Credits"}</span>
                    <span className="text-zinc-500">
                      {formatMinutesToDisplay(balance.remaining_minutes)} remaining of{" "}
                      {formatMinutesToDisplay(balance.total_minutes)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-zinc-900 transition-all dark:bg-zinc-100"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        {member.status === "cancelling" ? (
          <Button onClick={handleResume} disabled={isPending} variant="default">
            {isPending ? "Processing..." : "Resume Subscription"}
          </Button>
        ) : (
          <>
            <Button variant="outline" render={<a href="#plans" />}>
              Change Plan
            </Button>

            <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
              <AlertDialogTrigger render={<Button variant="destructive" />}>
                Cancel Subscription
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure you want to cancel?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your subscription will remain active until the end of the current billing period. After that, you will lose access to desk and meeting room credits. Your existing bookings will remain, but you won&apos;t be able to create new ones. You can resubscribe at any time.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={handleCancel}
                    disabled={isPending}
                  >
                    {isPending ? "Cancelling..." : "Cancel at Period End"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </div>
  );
}
