import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const headersList = await headers();
  const spaceName = headersList.get("x-space-name") ?? "Unknown Space";
  const spaceId = headersList.get("x-space-id");
  const spaceRole =
    (user.app_metadata?.space_role as string | undefined) ?? "member";
  const isAdmin = spaceRole === "admin" || spaceRole === "owner";

  // Fetch counts for admin
  let memberCount = 0;
  let resourceCount = 0;
  let planCount = 0;
  let hasStripe = false;

  if (isAdmin && spaceId) {
    const [members, resources, plans, tenant] = await Promise.all([
      supabase
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("space_id", spaceId),
      supabase
        .from("resources")
        .select("id", { count: "exact", head: true })
        .eq("space_id", spaceId),
      supabase
        .from("plans")
        .select("id", { count: "exact", head: true })
        .eq("space_id", spaceId),
      supabase
        .from("tenants")
        .select("stripe_onboarding_complete")
        .eq("id", user.app_metadata?.tenant_id)
        .single(),
    ]);

    memberCount = members.count ?? 0;
    resourceCount = resources.count ?? 0;
    planCount = plans.count ?? 0;
    hasStripe = tenant.data?.stripe_onboarding_complete ?? false;
  }

  const checklist = [
    {
      done: planCount > 0,
      label: "Configure plans",
      href: "/admin/plans",
    },
    {
      done: resourceCount > 0,
      label: "Add resources",
      href: "/admin/resources",
    },
    {
      done: hasStripe,
      label: "Connect Stripe",
      href: "/admin/settings?tab=payments",
    },
    {
      done: memberCount > 0,
      label: "Invite your first member",
      href: "/admin/members",
    },
  ];

  const allDone = checklist.every((item) => item.done);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          Welcome to {spaceName}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAdmin ? "Here's an overview of your space." : "Here's your summary."}
        </p>
      </div>

      {/* Member info */}
      <div className="grid gap-4 sm:grid-cols-3">
        <InfoCard title="Your plan" value="Not set up yet" />
        <InfoCard title="Upcoming bookings" value="None" />
        <InfoCard title="Credits" value="Not set up yet" />
      </div>

      {/* Admin section */}
      {isAdmin && (
        <>
          {/* Quick stats */}
          <div>
            <h3 className="text-lg font-medium text-foreground">
              Quick Stats
            </h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <StatCard label="Members" value={memberCount} />
              <StatCard label="Resources" value={resourceCount} />
              <StatCard label="Plans configured" value={planCount} />
            </div>
          </div>

          {/* Setup checklist */}
          {!allDone && (
            <div>
              <h3 className="text-lg font-medium text-foreground">
                Setup Checklist
              </h3>
              <div className="mt-3 overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--glass-shadow)] backdrop-blur-xl">
                {checklist.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 border-b border-[var(--glass-border)] px-4 py-3 text-sm transition-all duration-200 last:border-0 hover:bg-white/40 dark:hover:bg-white/5"
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        item.done
                          ? "border-green-500 bg-green-500 text-white"
                          : "border-[var(--glass-border)]"
                      }`}
                    >
                      {item.done && (
                        <svg
                          className="h-3 w-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </span>
                    <span
                      className={
                        item.done
                          ? "text-muted-foreground/50 line-through"
                          : "text-foreground/80"
                      }
                    >
                      {item.label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <SignOutButton />
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 shadow-[var(--glass-shadow)] backdrop-blur-xl">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <p className="mt-1 text-sm text-foreground/80">{value}</p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 shadow-[var(--glass-shadow)] backdrop-blur-xl">
      <p className="text-2xl font-semibold text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
