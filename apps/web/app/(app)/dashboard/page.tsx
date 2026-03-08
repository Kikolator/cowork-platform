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
      href: "/admin/settings",
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
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Welcome to {spaceName}
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
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
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
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
              <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
                Setup Checklist
              </h3>
              <div className="mt-3 rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                {checklist.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 text-sm transition-colors last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                        item.done
                          ? "border-green-500 bg-green-500 text-white"
                          : "border-zinc-300 dark:border-zinc-600"
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
                          ? "text-zinc-400 line-through"
                          : "text-zinc-700 dark:text-zinc-300"
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
    <div className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium text-zinc-500">{title}</p>
      <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{value}</p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  );
}
