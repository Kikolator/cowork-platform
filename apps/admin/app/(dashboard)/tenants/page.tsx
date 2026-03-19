import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-400/10 text-green-400 border-green-400/20",
  trial: "bg-blue-400/10 text-blue-400 border-blue-400/20",
  suspended: "bg-red-400/10 text-red-400 border-red-400/20",
  churned: "bg-muted text-muted-foreground border-border",
};

const PLAN_STYLES: Record<string, string> = {
  free: "text-muted-foreground",
  pro: "text-chart-1",
  enterprise: "text-chart-3",
};

async function getTenants() {
  const db = createAdminClient();

  const { data: tenants } = await db
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false });

  if (!tenants) return [];

  // Get space counts and member counts per tenant
  const tenantIds = tenants.map((t) => t.id);

  const { data: spaces } = await db
    .from("spaces")
    .select("id, tenant_id, slug, name")
    .in("tenant_id", tenantIds);

  const spaceIds = spaces?.map((s) => s.id) ?? [];

  const { data: memberCounts } = await db
    .from("members")
    .select("space_id")
    .in("space_id", spaceIds)
    .eq("status", "active");

  const spaceCountByTenant = new Map<string, number>();
  const memberCountByTenant = new Map<string, number>();

  const spaceToTenant = new Map<string, string>();
  for (const space of spaces ?? []) {
    spaceCountByTenant.set(
      space.tenant_id,
      (spaceCountByTenant.get(space.tenant_id) ?? 0) + 1
    );
    spaceToTenant.set(space.id, space.tenant_id);
  }

  for (const member of memberCounts ?? []) {
    const tenantId = spaceToTenant.get(member.space_id);
    if (tenantId) {
      memberCountByTenant.set(
        tenantId,
        (memberCountByTenant.get(tenantId) ?? 0) + 1
      );
    }
  }

  return tenants.map((t) => ({
    ...t,
    spaceCount: spaceCountByTenant.get(t.id) ?? 0,
    memberCount: memberCountByTenant.get(t.id) ?? 0,
  }));
}

export default async function TenantsPage() {
  const tenants = await getTenants();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Tenants
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tenants.length} tenants on the platform
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Tenant
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Plan
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Spaces
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Members
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Stripe
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Created
              </th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr
                key={tenant.id}
                className="border-b border-border/50 transition-colors hover:bg-muted/20"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/tenants/${tenant.id}`}
                    className="font-medium hover:underline"
                  >
                    {tenant.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {tenant.billing_email}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex rounded-md border px-2 py-0.5 text-xs font-medium",
                      STATUS_STYLES[tenant.status] ?? STATUS_STYLES.churned
                    )}
                  >
                    {tenant.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "text-xs font-medium uppercase tracking-wide",
                      PLAN_STYLES[tenant.platform_plan] ?? PLAN_STYLES.free
                    )}
                  >
                    {tenant.platform_plan}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  {tenant.spaceCount}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  {tenant.memberCount}
                </td>
                <td className="px-4 py-3">
                  {tenant.stripe_onboarding_complete ? (
                    <span className="text-xs text-green-400">Connected</span>
                  ) : tenant.stripe_account_id ? (
                    <span className="text-xs text-yellow-400">Incomplete</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Not started
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {tenant.created_at ? new Date(tenant.created_at).toLocaleDateString() : "N/A"}
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No tenants yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
