import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createLogger } from "@cowork/shared";
import { createClient } from "@/lib/supabase/server";
import { formatCredits, toUTC } from "@/lib/booking/format";
import { CalendarPlus, CalendarDays, CreditCard, Store } from "lucide-react";
import { TodaySchedule } from "./today-schedule";
import { UpcomingClosures } from "./upcoming-closures";

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

  const now = new Date().toISOString();

  // Fetch space timezone first (needed for today's date calculation)
  const { data: space } = spaceId
    ? await supabase.from("spaces").select("timezone").eq("id", spaceId).single()
    : { data: null };
  const timezone = space?.timezone ?? "Europe/Madrid";

  // Compute today's boundaries in space timezone using toUTC helper
  const todayLocal = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const todayStart = toUTC(todayLocal, "00:00", timezone);
  const tomorrow = new Date(new Date(todayLocal + "T12:00:00Z").getTime() + 86400000)
    .toISOString()
    .slice(0, 10);
  const todayEnd = toUTC(tomorrow, "00:00", timezone);

  // Compute time-of-day greeting in space timezone
  const localHour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
    10,
  );
  const greeting =
    localHour < 12 ? "Good morning" : localHour < 18 ? "Good afternoon" : "Good evening";

  // Fetch member data, upcoming count, today's bookings, closures, profile, and recent resources
  let memberResult, upcomingResult, todayResult, closuresResult, profileResult, recentBookingsResult;
  try {
  [memberResult, upcomingResult, todayResult, closuresResult, profileResult, recentBookingsResult] = await Promise.all([
    spaceId
      ? supabase
          .from("members")
          .select("id, status, plan_id, plan:plans(name, price_cents, currency)")
          .eq("user_id", user.id)
          .eq("space_id", spaceId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    spaceId
      ? supabase
          .from("bookings")
          .select("id")
          .eq("user_id", user.id)
          .eq("space_id", spaceId)
          .gte("start_time", now)
          .in("status", ["confirmed", "checked_in"])
      : Promise.resolve({ data: null }),
    spaceId
      ? supabase
          .from("bookings")
          .select(
            "id, start_time, end_time, status, resource:resources!inner(name, resource_type:resource_types!inner(name, slug))",
          )
          .eq("user_id", user.id)
          .eq("space_id", spaceId)
          .gte("start_time", todayStart)
          .lt("start_time", todayEnd)
          .in("status", ["confirmed", "checked_in", "completed"])
          .order("start_time", { ascending: true })
          .limit(10)
      : Promise.resolve({ data: null }),
    spaceId
      ? supabase
          .from("space_closures")
          .select("id, date, all_day, start_time, end_time, reason")
          .eq("space_id", spaceId)
          .gte("date", todayLocal)
          .order("date", { ascending: true })
          .limit(5)
      : Promise.resolve({ data: null }),
    supabase
      .from("shared_profiles")
      .select("full_name")
      .eq("id", user.id)
      .single(),
    spaceId
      ? supabase
          .from("bookings")
          .select("resource_id, resource:resources!inner(id, name, resource_type:resource_types!inner(name, slug))")
          .eq("user_id", user.id)
          .eq("space_id", spaceId)
          .in("status", ["completed", "checked_in", "confirmed"])
          .order("start_time", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: null }),
  ]);
  } catch (err) {
    createLogger({ component: "dashboard" }).error("Failed to load dashboard data", {
      error: err instanceof Error ? err.message : "Unknown error",
    });
    memberResult = { data: null };
    upcomingResult = { data: null };
    todayResult = { data: null };
    closuresResult = { data: null };
    profileResult = { data: null };
    recentBookingsResult = { data: null };
  }

  const member = memberResult.data;
  const closures = closuresResult.data ?? [];
  const upcomingCount = upcomingResult.data?.length ?? 0;
  const firstName = profileResult.data?.full_name?.split(" ")[0] ?? null;

  // Deduplicate recent resources (most recent first, max 3)
  const seen = new Set<string>();
  const recentResources: Array<{
    id: string;
    name: string;
    resource_type: { name: string; slug: string };
  }> = [];
  for (const b of recentBookingsResult.data ?? []) {
    const res = b.resource as unknown as {
      id: string;
      name: string;
      resource_type: { name: string; slug: string };
    };
    if (!seen.has(res.id)) {
      seen.add(res.id);
      recentResources.push(res);
      if (recentResources.length >= 3) break;
    }
  }

  // Cast today's bookings
  const todayBookings = (todayResult.data ?? []).map((b) => ({
    ...b,
    resource: b.resource as unknown as {
      name: string;
      resource_type: { name: string; slug: string };
    },
  }));

  // Fetch credit balances if member is active
  let creditBalances: Array<{
    resource_type_id: string;
    remaining_minutes: number;
    is_unlimited: boolean;
  }> = [];
  let resourceTypeNames: Record<string, string> = {};

  const hasActiveMembership =
    member && (member.status === "active" || member.status === "cancelling");

  if (hasActiveMembership && spaceId) {
    try {
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
    } catch (err) {
      createLogger({ component: "dashboard" }).error("Failed to load credit balances", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // Build plan display
  const plan = member?.plan as unknown as {
    name: string;
    price_cents: number;
    currency: string;
  } | null;
  const planDisplay = plan ? plan.name : "No active plan";

  // Build bookings display
  const bookingsDisplay =
    upcomingCount > 0
      ? `${upcomingCount} upcoming`
      : "None upcoming";

  // Build credits display
  let creditsDisplay = "No credits";
  if (hasActiveMembership && creditBalances.length > 0) {
    const parts = creditBalances.map((cb) => {
      const name = resourceTypeNames[cb.resource_type_id] ?? "Unknown";
      if (cb.is_unlimited) return `${name}: Unlimited`;
      return `${name}: ${formatCredits(cb.remaining_minutes)}`;
    });
    creditsDisplay = parts.join(" · ");
  }

  // Fetch admin counts
  let memberCount = 0;
  let resourceCount = 0;
  let planCount = 0;
  let hasStripe = false;

  if (isAdmin && spaceId) {
    try {
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
          .select("stripe_account_id")
          .eq("id", user.app_metadata?.tenant_id)
          .single(),
      ]);

      memberCount = members.count ?? 0;
      resourceCount = resources.count ?? 0;
      planCount = plans.count ?? 0;
      hasStripe = !!tenant.data?.stripe_account_id;
    } catch (err) {
      createLogger({ component: "dashboard" }).error("Failed to load admin stats", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
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
          {greeting}{firstName ? `, ${firstName}` : ""}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAdmin
            ? `Here's an overview of ${spaceName}.`
            : `Welcome to ${spaceName}. Here's your summary.`}
        </p>
      </div>

      {/* Member info */}
      <div className="grid gap-4 sm:grid-cols-3">
        <LinkCard title="Your plan" value={planDisplay} href="/plan" />
        <LinkCard
          title="Upcoming bookings"
          value={bookingsDisplay}
          href="/bookings"
        />
        <InfoCard title="Credits" value={creditsDisplay} />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <QuickAction href="/book" icon={<CalendarPlus className="h-4 w-4" />} label="Book a space" />
        <QuickAction href="/bookings" icon={<CalendarDays className="h-4 w-4" />} label="My bookings" />
        <QuickAction href="/plan" icon={<CreditCard className="h-4 w-4" />} label="My plan" />
        <QuickAction href="/store" icon={<Store className="h-4 w-4" />} label="Store" />
      </div>

      {/* Today's schedule */}
      <TodaySchedule bookings={todayBookings} timezone={timezone} />

      {/* Upcoming closures */}
      {closures.length > 0 && (
        <UpcomingClosures closures={closures} timezone={timezone} />
      )}

      {/* Book again — recent resources */}
      {recentResources.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-foreground">Book again</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {recentResources.map((res) => {
              const href =
                res.resource_type.slug === "desk"
                  ? "/book/desk"
                  : `/book/room/${res.id}`;
              return (
                <Link
                  key={res.id}
                  href={href}
                  className="group rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 shadow-[var(--glass-shadow)] backdrop-blur-xl transition-colors hover:bg-white/40 dark:hover:bg-white/5"
                >
                  <p className="truncate text-sm font-medium text-foreground group-hover:text-foreground">
                    {res.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {res.resource_type.name}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

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

function LinkCard({
  title,
  value,
  href,
}: {
  title: string;
  value: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 shadow-[var(--glass-shadow)] backdrop-blur-xl transition-colors hover:bg-white/40 dark:hover:bg-white/5"
    >
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <p className="mt-1 text-sm text-foreground/80 group-hover:text-foreground">
        {value}
      </p>
    </Link>
  );
}

function QuickAction({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-2.5 text-sm font-medium text-foreground/80 shadow-[var(--glass-shadow)] backdrop-blur-xl transition-colors hover:bg-white/40 hover:text-foreground dark:hover:bg-white/5"
    >
      {icon}
      {label}
    </Link>
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
