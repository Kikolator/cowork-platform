import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  desk_weight: number;
  sort_order: number | null;
  plan_credit_config: PlanCreditConfig[];
}

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const referralCode = typeof params.ref === "string" ? params.ref : null;
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

  // Get space tax config
  const { data: spaceConfig } = await supabase
    .from("spaces")
    .select("default_iva_rate, tax_inclusive")
    .eq("id", spaceId)
    .single();
  const taxConfig = {
    ivaRate: spaceConfig?.default_iva_rate ?? 21,
    taxInclusive: spaceConfig?.tax_inclusive ?? true,
  };

  // Get all active plans with credit config and space capacity
  const [{ data: plans }, { data: capacityData }] = await Promise.all([
    supabase
      .from("plans")
      .select("*, plan_credit_config(*, resource_types(id, name, slug))")
      .eq("space_id", spaceId)
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase.rpc("get_space_capacity", { p_space_id: spaceId }),
  ]);

  const capacity = capacityData as { total_desks: number; consumed: number; remaining: number } | null;

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

  // Validate referral code if present (uses admin client to bypass RLS on referral_codes)
  let referralBanner: { referrerName: string | null; discountPercent: number; discountMonths: number } | null = null;
  if (referralCode && (!member || member.status === "churned")) {
    const admin = createAdminClient();
    const { data: codeData } = await admin
      .from("referral_codes")
      .select("user_id")
      .eq("space_id", spaceId)
      .eq("code", referralCode.toUpperCase().trim())
      .eq("active", true)
      .maybeSingle();

    if (codeData) {
      const [{ data: profile }, { data: program }] = await Promise.all([
        admin
          .from("shared_profiles")
          .select("full_name")
          .eq("id", codeData.user_id)
          .single(),
        admin
          .from("referral_programs")
          .select("referred_discount_percent, referred_discount_months")
          .eq("space_id", spaceId)
          .eq("active", true)
          .maybeSingle(),
      ]);

      if (program && program.referred_discount_percent > 0) {
        referralBanner = {
          referrerName: profile?.full_name ?? null,
          discountPercent: program.referred_discount_percent,
          discountMonths: program.referred_discount_months,
        };
      }
    }
  }

  return (
    <div className="space-y-8">
      {referralBanner && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          {referralBanner.referrerName
            ? `${referralBanner.referrerName} referred you!`
            : "You were referred!"}{" "}
          You&apos;ll get {referralBanner.discountPercent}% off your first{" "}
          {referralBanner.discountMonths === 1
            ? "month"
            : `${referralBanner.discountMonths} months`}
          .
        </div>
      )}

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

      {member && member.status !== "churned" && member.plan_id && (
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
        capacity={capacity}
        referralCode={referralCode}
        taxConfig={taxConfig}
      />
    </div>
  );
}
