import {
  Building2,
  Users,
  DollarSign,
  CreditCard,
  AlertTriangle,
  Plug,
} from "lucide-react";
import { createLogger } from "@cowork/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformBalance, getApplicationFeesSummary } from "@/lib/stripe/platform";
import { MetricCard } from "@/components/metric-card";

function formatCurrency(cents: number, currency = "eur") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

async function getPlatformStats() {
  const db = createAdminClient();

  try {
    const [
      { count: totalTenants },
      { count: activeTenants },
      { count: trialTenants },
      { count: totalMembers },
      { count: pastDueMembers },
      { count: stripeConnected },
    ] = await Promise.all([
      db.from("tenants").select("*", { count: "exact", head: true }),
      db
        .from("tenants")
        .select("*", { count: "exact", head: true })
        .eq("status", "active"),
      db
        .from("tenants")
        .select("*", { count: "exact", head: true })
        .eq("status", "trial"),
      db
        .from("members")
        .select("*", { count: "exact", head: true })
        .eq("status", "active"),
      db
        .from("members")
        .select("*", { count: "exact", head: true })
        .eq("status", "past_due"),
      db
        .from("tenants")
        .select("*", { count: "exact", head: true })
        .eq("stripe_onboarding_complete", true),
    ]);

    return {
      totalTenants: totalTenants ?? 0,
      activeTenants: activeTenants ?? 0,
      trialTenants: trialTenants ?? 0,
      totalMembers: totalMembers ?? 0,
      pastDueMembers: pastDueMembers ?? 0,
      stripeConnected: stripeConnected ?? 0,
    };
  } catch (err) {
    createLogger({ component: "admin/dashboard" }).error("Failed to load platform stats", {
      error: err instanceof Error ? err.message : "Unknown error",
    });
    return {
      totalTenants: 0,
      activeTenants: 0,
      trialTenants: 0,
      totalMembers: 0,
      pastDueMembers: 0,
      stripeConnected: 0,
    };
  }
}

export default async function OverviewPage() {
  const [stats, feesSummary] = await Promise.all([
    getPlatformStats(),
    getApplicationFeesSummary(30).catch(() => ({
      totalFeeCents: 0,
      count: 0,
      transactions: [],
    })),
  ]);

  let balanceAvailable = 0;
  try {
    const balance = await getPlatformBalance();
    for (const b of balance.available) {
      balanceAvailable += b.amount;
    }
  } catch {
    // Stripe may not be configured yet
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Platform Overview
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          RogueOps platform administration dashboard
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Total Tenants"
          value={stats.totalTenants}
          description={`${stats.activeTenants} active, ${stats.trialTenants} trial`}
          icon={Building2}
        />
        <MetricCard
          label="Active Members"
          value={stats.totalMembers}
          description="Across all spaces"
          icon={Users}
        />
        <MetricCard
          label="Platform Fees (30d)"
          value={formatCurrency(feesSummary.totalFeeCents)}
          description={`${feesSummary.count} transactions`}
          icon={DollarSign}
          trend={feesSummary.totalFeeCents > 0 ? "up" : "neutral"}
        />
        <MetricCard
          label="Available Balance"
          value={formatCurrency(balanceAvailable)}
          description="Platform Stripe balance"
          icon={CreditCard}
        />
        <MetricCard
          label="Past Due Members"
          value={stats.pastDueMembers}
          description="Failed payments across platform"
          icon={AlertTriangle}
          trend={stats.pastDueMembers > 0 ? "down" : "neutral"}
        />
        <MetricCard
          label="Stripe Connected"
          value={`${stats.stripeConnected} / ${stats.totalTenants}`}
          description="Tenants with active Stripe Connect"
          icon={Plug}
        />
      </div>
    </div>
  );
}
