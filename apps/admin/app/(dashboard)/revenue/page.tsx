import { DollarSign, TrendingUp, AlertTriangle, CreditCard } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPlatformBalance,
  getApplicationFeesSummary,
  getPaymentVolume,
} from "@/lib/stripe/platform";
import { MetricCard } from "@/components/metric-card";
import { cn } from "@/lib/utils";

function formatCurrency(cents: number, currency = "eur") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export default async function RevenuePage() {
  const [feesSummary, volume] = await Promise.all([
    getApplicationFeesSummary(30).catch(() => ({
      totalFeeCents: 0,
      count: 0,
      transactions: [],
    })),
    getPaymentVolume(30).catch(() => ({
      totalVolumeCents: 0,
      successCount: 0,
      failedCount: 0,
    })),
  ]);

  let balanceAvailable = 0;
  let balancePending = 0;
  try {
    const balance = await getPlatformBalance();
    for (const b of balance.available) balanceAvailable += b.amount;
    for (const b of balance.pending) balancePending += b.amount;
  } catch {
    // Stripe may not be configured
  }

  // Recent failed payments from DB
  const db = createAdminClient();
  const { data: failedEvents } = await db
    .from("payment_events")
    .select("*")
    .eq("event_type", "invoice.payment_failed")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Revenue
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform fee revenue and payment volume (last 30 days)
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Platform Fees (30d)"
          value={formatCurrency(feesSummary.totalFeeCents)}
          description={`${feesSummary.count} fee transactions`}
          icon={DollarSign}
          trend={feesSummary.totalFeeCents > 0 ? "up" : "neutral"}
        />
        <MetricCard
          label="Payment Volume (30d)"
          value={formatCurrency(volume.totalVolumeCents)}
          description={`${volume.successCount} successful charges`}
          icon={TrendingUp}
        />
        <MetricCard
          label="Available Balance"
          value={formatCurrency(balanceAvailable)}
          description={`${formatCurrency(balancePending)} pending`}
          icon={CreditCard}
        />
        <MetricCard
          label="Failed Payments (30d)"
          value={volume.failedCount}
          description="Across all tenants"
          icon={AlertTriangle}
          trend={volume.failedCount > 0 ? "down" : "neutral"}
        />
      </div>

      {/* Recent fee transactions */}
      <div>
        <h2 className="font-display text-lg font-semibold">
          Recent Application Fees
        </h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Transaction
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Amount
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Net
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {feesSummary.transactions.map((tx) => (
                <tr
                  key={tx.id}
                  className="border-b border-border/50"
                >
                  <td className="px-4 py-3 font-mono text-xs">
                    {tx.id}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {formatCurrency(tx.amount, tx.currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {formatCurrency(tx.net, tx.currency)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {new Date(tx.created * 1000).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {feesSummary.transactions.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No fee transactions in the last 30 days
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Failed payments */}
      {failedEvents && failedEvents.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-semibold">
            Recent Failed Payments
          </h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Event ID
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {failedEvents.map((event) => (
                  <tr
                    key={event.id}
                    className="border-b border-border/50"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      {event.stripe_event_id}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-xs font-medium",
                          event.processed ? "text-green-400" : "text-yellow-400"
                        )}
                      >
                        {event.processed ? "Handled" : "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {event.created_at ? new Date(event.created_at).toLocaleString() : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
