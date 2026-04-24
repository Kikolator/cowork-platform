"use client";

import { useState } from "react";
import { PlanCard } from "./plan-card";
import { FiscalIdForm } from "./fiscal-id-form";

interface CreditConfig {
  resource_type_id: string;
  monthly_minutes: number;
  is_unlimited: boolean;
  resource_types: { id: string; name: string; slug: string } | null;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  currency: string;
  access_type: string;
  has_fixed_desk: boolean | null;
  desk_weight: number;
  sort_order: number | null;
  plan_credit_config: CreditConfig[];
}

interface SpaceCapacity {
  total_desks: number;
  consumed: number;
  remaining: number;
}

interface TaxConfig {
  ivaRate: number;
  taxInclusive: boolean;
}

interface PlanGridProps {
  plans: Plan[];
  currentPlanId: string | null;
  memberStatus: string | null;
  capacity: SpaceCapacity | null;
  referralCode?: string | null;
  taxConfig?: TaxConfig;
}

export function PlanGrid({ plans, currentPlanId, memberStatus, capacity, referralCode, taxConfig }: PlanGridProps) {
  const [error, setError] = useState<string | null>(null);
  const [fiscalIdPlanId, setFiscalIdPlanId] = useState<string | null>(null);

  if (plans.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
        <p className="text-sm text-zinc-500">No plans available yet.</p>
      </div>
    );
  }

  return (
    <div id="plans">
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isCurrent={plan.id === currentPlanId}
            memberStatus={memberStatus}
            spotsLeft={
              capacity && plan.desk_weight > 0
                ? Math.floor(capacity.remaining / plan.desk_weight)
                : null
            }
            onError={setError}
            onFiscalIdRequired={(planId) => setFiscalIdPlanId(planId)}
            referralCode={referralCode}
            taxConfig={taxConfig}
          />
        ))}
      </div>

      <FiscalIdForm
        open={fiscalIdPlanId !== null}
        onOpenChange={(open) => { if (!open) setFiscalIdPlanId(null); }}
        planId={fiscalIdPlanId}
        onError={setError}
        referralCode={referralCode}
      />
    </div>
  );
}
