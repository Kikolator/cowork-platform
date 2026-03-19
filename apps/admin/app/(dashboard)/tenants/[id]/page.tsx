import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConnectedAccountDetails } from "@/lib/stripe/platform";
import { cn } from "@/lib/utils";
import { TenantActions } from "./actions-ui";

function formatCurrency(cents: number, currency = "eur") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();

  const { data: tenant } = await db
    .from("tenants")
    .select("*")
    .eq("id", id)
    .single();

  if (!tenant) notFound();

  const { data: spaces } = await db
    .from("spaces")
    .select("id, name, slug, active, currency")
    .eq("tenant_id", tenant.id);

  // Get member counts per space
  const spaceIds = spaces?.map((s) => s.id) ?? [];
  const { data: members } = await db
    .from("members")
    .select("space_id, status")
    .in("space_id", spaceIds);

  const membersBySpace = new Map<string, { active: number; total: number }>();
  for (const m of members ?? []) {
    const counts = membersBySpace.get(m.space_id) ?? { active: 0, total: 0 };
    counts.total++;
    if (m.status === "active") counts.active++;
    membersBySpace.set(m.space_id, counts);
  }

  // Get Stripe account details if connected
  let stripeAccount: Awaited<ReturnType<typeof getConnectedAccountDetails>> | null = null;
  if (tenant.stripe_account_id) {
    try {
      stripeAccount = await getConnectedAccountDetails(tenant.stripe_account_id);
    } catch {
      // Account may have been deleted on Stripe's side
    }
  }

  // Get recent payment events
  const { data: recentEvents } = await db
    .from("payment_events")
    .select("*")
    .eq("stripe_account_id", tenant.stripe_account_id ?? "")
    .order("created_at", { ascending: false })
    .limit(10);

  // Get monthly stats
  const { data: monthlyStats } = await db
    .from("monthly_stats")
    .select("*")
    .in("space_id", spaceIds)
    .order("month", { ascending: false })
    .limit(6);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link
          href="/tenants"
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {tenant.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tenant.billing_email}
          </p>
        </div>
        <TenantActions tenantId={tenant.id} currentStatus={tenant.status} />
      </div>

      {/* Tenant Info */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Tenant Details
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium capitalize">{tenant.status}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Platform Plan</dt>
              <dd className="font-medium uppercase">{tenant.platform_plan}</dd>
            </div>
            {tenant.trial_ends_at && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Trial Ends</dt>
                <dd className="font-mono text-xs">
                  {new Date(tenant.trial_ends_at).toLocaleDateString()}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Created</dt>
              <dd className="font-mono text-xs">
                {tenant.created_at ? new Date(tenant.created_at).toLocaleDateString() : "N/A"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Stripe Connect
          </h2>
          {stripeAccount ? (
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Account ID</dt>
                <dd className="font-mono text-xs">{stripeAccount.id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Charges Enabled</dt>
                <dd>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      stripeAccount.charges_enabled
                        ? "text-green-400"
                        : "text-red-400"
                    )}
                  >
                    {stripeAccount.charges_enabled ? "Yes" : "No"}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Payouts Enabled</dt>
                <dd>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      stripeAccount.payouts_enabled
                        ? "text-green-400"
                        : "text-red-400"
                    )}
                  >
                    {stripeAccount.payouts_enabled ? "Yes" : "No"}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Dashboard</dt>
                <dd>
                  <a
                    href={`https://dashboard.stripe.com/${stripeAccount.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-chart-1 hover:underline"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              {tenant.stripe_account_id
                ? "Account exists but could not be retrieved"
                : "Not connected to Stripe"}
            </p>
          )}
        </div>
      </div>

      {/* Spaces */}
      <div>
        <h2 className="font-display text-lg font-semibold">Spaces</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Space
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Slug
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Active Members
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Total Members
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {(spaces ?? []).map((space) => {
                const counts = membersBySpace.get(space.id) ?? {
                  active: 0,
                  total: 0,
                };
                return (
                  <tr
                    key={space.id}
                    className="border-b border-border/50 transition-colors hover:bg-muted/20"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/spaces/${space.id}`}
                        className="font-medium hover:underline"
                      >
                        {space.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {space.slug}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {counts.active}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {counts.total}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-xs font-medium",
                          space.active ? "text-green-400" : "text-red-400"
                        )}
                      >
                        {space.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue Timeline */}
      {monthlyStats && monthlyStats.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-semibold">
            Revenue History
          </h2>
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
                    Total Revenue
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Members
                  </th>
                </tr>
              </thead>
              <tbody>
                {monthlyStats.map((stat) => (
                  <tr
                    key={stat.id}
                    className="border-b border-border/50"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      {new Date(stat.month).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {formatCurrency(stat.mrr_cents ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {formatCurrency(stat.total_revenue_cents ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {stat.total_members ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Payment Events */}
      {recentEvents && recentEvents.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-semibold">
            Recent Payment Events
          </h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Event
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
                {recentEvents.map((event) => (
                  <tr
                    key={event.id}
                    className="border-b border-border/50"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      {event.event_type}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-xs font-medium",
                          event.processed ? "text-green-400" : "text-yellow-400"
                        )}
                      >
                        {event.processed ? "Processed" : "Pending"}
                      </span>
                      {event.error && (
                        <span className="ml-2 text-xs text-red-400">
                          {event.error}
                        </span>
                      )}
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
