import { Users, TrendingUp, Building2, BarChart3 } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { MetricCard } from "@/components/metric-card";

function formatCurrency(cents: number, currency = "eur") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function AnalyticsPage() {
  const db = createAdminClient();

  // Aggregated monthly stats (last 12 months)
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const { data: monthlyStats } = await db
    .from("monthly_stats")
    .select("*")
    .gte("month", twelveMonthsAgo.toISOString().split("T")[0]!)
    .order("month", { ascending: false });

  // Aggregate by month across all spaces
  const monthlyAggregates = new Map<
    string,
    {
      totalMembers: number;
      newMembers: number;
      churnedMembers: number;
      mrrCents: number;
      totalRevenueCents: number;
      avgOccupancy: number;
      spaceCount: number;
    }
  >();

  for (const stat of monthlyStats ?? []) {
    const month = stat.month;
    const agg = monthlyAggregates.get(month) ?? {
      totalMembers: 0,
      newMembers: 0,
      churnedMembers: 0,
      mrrCents: 0,
      totalRevenueCents: 0,
      avgOccupancy: 0,
      spaceCount: 0,
    };

    agg.totalMembers += stat.total_members ?? 0;
    agg.newMembers += stat.new_members ?? 0;
    agg.churnedMembers += stat.churned_members ?? 0;
    agg.mrrCents += stat.mrr_cents ?? 0;
    agg.totalRevenueCents += stat.total_revenue_cents ?? 0;
    agg.avgOccupancy += stat.avg_desk_occupancy ?? 0;
    agg.spaceCount += 1;

    monthlyAggregates.set(month, agg);
  }

  const sortedMonths = Array.from(monthlyAggregates.entries())
    .sort(([a], [b]) => b.localeCompare(a));

  const currentMonth = sortedMonths[0];
  const previousMonth = sortedMonths[1];

  // Tenant lifecycle
  const { count: totalTenants } = await db
    .from("tenants")
    .select("*", { count: "exact", head: true });

  const { count: trialTenants } = await db
    .from("tenants")
    .select("*", { count: "exact", head: true })
    .eq("status", "trial");

  const { count: churnedTenants } = await db
    .from("tenants")
    .select("*", { count: "exact", head: true })
    .eq("status", "churned");

  const conversionRate =
    totalTenants && totalTenants > 0
      ? Math.round(
          (((totalTenants ?? 0) - (trialTenants ?? 0) - (churnedTenants ?? 0)) /
            totalTenants) *
            100
        )
      : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Analytics
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform-wide metrics and trends
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Platform MRR"
          value={formatCurrency(currentMonth?.[1].mrrCents ?? 0)}
          description={
            previousMonth
              ? `${formatCurrency(previousMonth[1].mrrCents)} previous month`
              : "No previous data"
          }
          icon={TrendingUp}
          trend={
            currentMonth && previousMonth
              ? currentMonth[1].mrrCents > previousMonth[1].mrrCents
                ? "up"
                : "down"
              : "neutral"
          }
        />
        <MetricCard
          label="Total Members"
          value={currentMonth?.[1].totalMembers ?? 0}
          description={`${currentMonth?.[1].newMembers ?? 0} new this month`}
          icon={Users}
        />
        <MetricCard
          label="Avg Desk Occupancy"
          value={
            currentMonth && currentMonth[1].spaceCount > 0
              ? `${Math.round(currentMonth[1].avgOccupancy / currentMonth[1].spaceCount)}%`
              : "N/A"
          }
          description="Across all spaces"
          icon={BarChart3}
        />
        <MetricCard
          label="Trial Conversion"
          value={`${conversionRate}%`}
          description={`${trialTenants ?? 0} in trial, ${churnedTenants ?? 0} churned`}
          icon={Building2}
        />
      </div>

      {/* Monthly trend table */}
      <div>
        <h2 className="font-display text-lg font-semibold">Monthly Trends</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Month
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  MRR
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Revenue
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Members
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  New
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Churned
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedMonths.map(([month, agg]) => (
                <tr key={month} className="border-b border-border/50">
                  <td className="px-4 py-3 font-mono text-xs">
                    {new Date(month).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {formatCurrency(agg.mrrCents)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {formatCurrency(agg.totalRevenueCents)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {agg.totalMembers}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-green-400">
                    +{agg.newMembers}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-red-400">
                    -{agg.churnedMembers}
                  </td>
                </tr>
              ))}
              {sortedMonths.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No monthly stats recorded yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
