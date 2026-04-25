"use client";

import { useTransition } from "react";
import { Check, Infinity, Shield, Clock, Armchair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { subscribeToPlan, changePlan } from "./actions";

interface CreditConfig {
  resource_type_id: string;
  monthly_minutes: number;
  is_unlimited: boolean;
  resource_types: { id: string; name: string; slug: string } | null;
}

interface PlanCardProps {
  plan: {
    id: string;
    name: string;
    description: string | null;
    price_cents: number;
    currency: string;
    access_type: string;
    has_fixed_desk: boolean | null;
    plan_credit_config: CreditConfig[];
  };
  isCurrent: boolean;
  memberStatus: string | null;
  /** Number of spots available for this plan, or null if no desk capacity applies */
  spotsLeft: number | null;
  onError: (msg: string) => void;
  onFiscalIdRequired: (planId: string) => void;
  referralCode?: string | null;
  taxConfig?: { ivaRate: number; taxInclusive: boolean };
}

const ACCESS_LABELS: Record<string, string> = {
  business_hours: "Business Hours",
  extended: "Extended Hours",
  twenty_four_seven: "24/7 Access",
  none: "No Access",
};

function formatMinutesToHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

function formatPrice(cents: number, currency: string): string {
  const amount = cents / 100;
  const symbol = currency.toLowerCase() === "eur" ? "\u20AC" : currency.toUpperCase() + " ";
  return `${symbol}${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

export function PlanCard({
  plan,
  isCurrent,
  memberStatus,
  spotsLeft,
  onError,
  onFiscalIdRequired,
  referralCode,
  taxConfig,
}: PlanCardProps) {
  const [isPending, startTransition] = useTransition();

  const hasActiveMembership = memberStatus === "active" || memberStatus === "cancelling" || memberStatus === "past_due" || memberStatus === "paused";
  const isSoldOut = spotsLeft !== null && spotsLeft <= 0 && !isCurrent;

  function handleAction() {
    startTransition(async () => {
      if (hasActiveMembership) {
        const result = await changePlan(plan.id);
        if (!result.success) {
          onError(result.error);
        }
      } else {
        const result = await subscribeToPlan(plan.id, undefined, referralCode ?? undefined);
        if (!result.success) {
          if (result.error === "fiscal_id_required") {
            onFiscalIdRequired(plan.id);
          } else {
            onError(result.error);
          }
          return;
        }
        window.location.href = result.url;
      }
    });
  }

  return (
    <div
      className={`relative flex flex-col rounded-xl border bg-white p-6 dark:bg-zinc-900 ${
        isCurrent
          ? "border-zinc-900 ring-1 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      {isCurrent && (
        <div className="absolute -top-3 left-4">
          <Badge variant="default">Current Plan</Badge>
        </div>
      )}
      {isSoldOut && (
        <div className="absolute -top-3 right-4">
          <Badge variant="destructive">Sold Out</Badge>
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-lg font-semibold">{plan.name}</h3>
        {plan.description && (
          <p className="mt-1 text-sm text-zinc-500">{plan.description}</p>
        )}
      </div>

      <div className="mb-6">
        <span className="text-3xl font-bold">{formatPrice(plan.price_cents, plan.currency)}</span>
        <span className="text-sm text-zinc-500">/mo</span>
        {taxConfig && taxConfig.ivaRate > 0 && (
          <p className="mt-1 text-xs text-zinc-500">
            {taxConfig.taxInclusive
              ? `incl. ${taxConfig.ivaRate}% IVA`
              : `+ ${taxConfig.ivaRate}% IVA`}
          </p>
        )}
      </div>

      <div className="mb-6 flex-1 space-y-3">
        {plan.plan_credit_config.map((config) => (
          <div key={config.resource_type_id} className="flex items-center gap-2 text-sm">
            <Check className="size-4 shrink-0 text-emerald-500" />
            <span>
              {config.is_unlimited
                ? `Unlimited ${config.resource_types?.name ?? "credits"}`
                : `${formatMinutesToHours(config.monthly_minutes)} ${config.resource_types?.name ?? "credits"}`}
            </span>
          </div>
        ))}

        {plan.access_type !== "none" && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="size-4 shrink-0 text-emerald-500" />
            <span>{ACCESS_LABELS[plan.access_type] ?? plan.access_type}</span>
          </div>
        )}

        {plan.has_fixed_desk && (
          <div className="flex items-center gap-2 text-sm">
            <Armchair className="size-4 shrink-0 text-emerald-500" />
            <span>Fixed desk included</span>
          </div>
        )}
      </div>

      {spotsLeft !== null && spotsLeft > 0 && spotsLeft <= 5 && !isCurrent && (
        <p className="mb-2 text-center text-xs font-medium text-amber-600 dark:text-amber-400">
          Only {spotsLeft} {spotsLeft === 1 ? "spot" : "spots"} left
        </p>
      )}

      <Button
        onClick={handleAction}
        disabled={isCurrent || isPending || isSoldOut}
        variant={isCurrent ? "outline" : "default"}
        size="lg"
        className="w-full"
      >
        {isPending
          ? "Processing..."
          : isSoldOut
            ? "Sold Out"
            : isCurrent
              ? "Current Plan"
              : hasActiveMembership
                ? `Switch to ${plan.name}`
                : "Subscribe"}
      </Button>
    </div>
  );
}
