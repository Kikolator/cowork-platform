import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PlanGrid } from "./plan-grid";
import { CurrentPlan } from "./current-plan";

interface PlanCreditConfig {
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
  sort_order: number | null;
  plan_credit_config: PlanCreditConfig[];
}

export default async function PlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const spaceId = user.app_metadata?.space_id as string | undefined;
  if (!spaceId) redirect("/login");

  // Check existing membership
  const { data: member } = await supabase
    .from("members")
    .select("*, plan:plans(*)")
    .eq("user_id", user.id)
    .eq("space_id", spaceId)
    .maybeSingle();

  // Get all active plans with credit config
  const { data: plans } = await supabase
    .from("plans")
    .select("*, plan_credit_config(*, resource_types(id, name, slug))")
    .eq("space_id", spaceId)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  // Get credit balances and resource type names if member exists
  let creditBalances: Array<{
    resource_type_id: string;
    total_minutes: number;
    used_minutes: number;
    remaining_minutes: number;
    is_unlimited: boolean;
  }> = [];
  let resourceTypeNames: Record<string, string> = {};

  if (member && (member.status === "active" || member.status === "cancelling")) {
    const [balanceResult, rtResult] = await Promise.all([
      supabase.rpc("get_credit_balance", {
        p_space_id: spaceId,
        p_user_id: user.id,
      }),
      supabase
        .from("resource_types")
        .select("id, name")
        .eq("space_id", spaceId),
    ]);
    creditBalances = balanceResult.data ?? [];
    resourceTypeNames = Object.fromEntries(
      (rtResult.data ?? []).map((rt) => [rt.id, rt.name]),
    );
  }

  const typedPlans = (plans ?? []) as unknown as Plan[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">
          {member && member.status !== "churned" ? "My Plan" : "Choose a Plan"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {member && member.status !== "churned"
            ? "Manage your subscription and view your credits."
            : "Select a plan to get started with your membership."}
        </p>
      </div>

      {member && member.status !== "churned" && (
        <CurrentPlan
          member={{
            id: member.id,
            status: member.status,
            plan_id: member.plan_id,
            stripe_subscription_id: member.stripe_subscription_id,
            cancel_requested_at: member.cancel_requested_at,
          }}
          plan={member.plan as unknown as { id: string; name: string; price_cents: number; currency: string }}
          creditBalances={creditBalances}
          resourceTypeNames={resourceTypeNames}
        />
      )}

      <PlanGrid
        plans={typedPlans}
        currentPlanId={member && member.status !== "churned" ? member.plan_id : null}
        memberStatus={member?.status ?? null}
      />
    </div>
  );
}
