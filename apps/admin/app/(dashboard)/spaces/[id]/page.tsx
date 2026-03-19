import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";

function formatCurrency(cents: number, currency = "eur") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function SpaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();

  const { data: space } = await db
    .from("spaces")
    .select("*, tenants(id, name)")
    .eq("id", id)
    .single();

  if (!space) notFound();

  // Members
  const { data: members } = await db
    .from("members")
    .select("*, plans(name), shared_profiles!inner(full_name, email)")
    .eq("space_id", id)
    .order("joined_at", { ascending: false });

  // Recent bookings
  const { data: bookings } = await db
    .from("bookings")
    .select("*, resources(name), shared_profiles!inner(full_name)")
    .eq("space_id", id)
    .order("start_time", { ascending: false })
    .limit(20);

  // Monthly stats
  const { data: monthlyStats } = await db
    .from("monthly_stats")
    .select("*")
    .eq("space_id", id)
    .order("month", { ascending: false })
    .limit(6);

  // Active passes
  const { data: passes } = await db
    .from("passes")
    .select("*, shared_profiles!inner(full_name)")
    .eq("space_id", id)
    .eq("status", "active")
    .order("start_date", { ascending: false });

  const tenant = space.tenants as unknown as { id: string; name: string } | null;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        {tenant && (
          <Link
            href={`/tenants/${tenant.id}`}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        )}
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {space.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tenant?.name} &middot; {space.slug} &middot;{" "}
            {space.city ?? "No city"}
          </p>
        </div>
      </div>

      {/* Members */}
      <div>
        <h2 className="font-display text-lg font-semibold">
          Members ({members?.length ?? 0})
        </h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Member
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Plan
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody>
              {(members ?? []).map((member) => {
                const profile = member.shared_profiles as unknown as {
                  full_name: string | null;
                  email: string;
                };
                const plan = member.plans as unknown as { name: string } | null;
                return (
                  <tr
                    key={member.id}
                    className="border-b border-border/50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {profile?.full_name ?? "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {profile?.email}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {plan?.name ?? "No plan"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-md border px-2 py-0.5 text-xs font-medium",
                          member.status === "active" &&
                            "border-green-400/20 bg-green-400/10 text-green-400",
                          member.status === "past_due" &&
                            "border-red-400/20 bg-red-400/10 text-red-400",
                          member.status === "cancelling" &&
                            "border-yellow-400/20 bg-yellow-400/10 text-yellow-400",
                          member.status === "churned" &&
                            "border-border bg-muted text-muted-foreground"
                        )}
                      >
                        {member.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {member.joined_at
                        ? new Date(member.joined_at).toLocaleDateString()
                        : "N/A"}
                    </td>
                  </tr>
                );
              })}
              {(!members || members.length === 0) && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No members
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue History */}
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
                    Revenue
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Members
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Occupancy
                  </th>
                </tr>
              </thead>
              <tbody>
                {monthlyStats.map((stat) => (
                  <tr key={stat.id} className="border-b border-border/50">
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
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {stat.avg_desk_occupancy ?? 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Bookings */}
      <div>
        <h2 className="font-display text-lg font-semibold">
          Recent Bookings
        </h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  User
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Resource
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {(bookings ?? []).map((booking) => {
                const profile = booking.shared_profiles as unknown as {
                  full_name: string | null;
                };
                const resource = booking.resources as unknown as {
                  name: string;
                } | null;
                return (
                  <tr
                    key={booking.id}
                    className="border-b border-border/50"
                  >
                    <td className="px-4 py-3 text-xs">
                      {profile?.full_name ?? "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {resource?.name ?? "N/A"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium capitalize">
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {new Date(booking.start_time).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
              {(!bookings || bookings.length === 0) && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No recent bookings
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Passes */}
      {passes && passes.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-semibold">Active Passes</h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    User
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Dates
                  </th>
                </tr>
              </thead>
              <tbody>
                {passes.map((pass) => {
                  const profile = pass.shared_profiles as unknown as {
                    full_name: string | null;
                  };
                  return (
                    <tr key={pass.id} className="border-b border-border/50">
                      <td className="px-4 py-3 text-xs">
                        {profile?.full_name ?? "Unknown"}
                      </td>
                      <td className="px-4 py-3 text-xs capitalize">
                        {pass.pass_type}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {pass.start_date} - {pass.end_date}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
