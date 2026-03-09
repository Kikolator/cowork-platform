import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDeskAvailabilityRange } from "@/lib/booking/availability";
import { getAdvanceBookingLimit } from "@/lib/booking/rules";
import { formatDuration, type BusinessHours, type DayKey } from "@/lib/booking/format";
import { DeskCalendar } from "./desk-calendar";
import { Badge } from "@/components/ui/badge";

export default async function DeskBookingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const spaceId = user.app_metadata?.space_id as string | undefined;
  if (!spaceId) redirect("/");

  // Fetch member info
  const { data: member } = await supabase
    .from("members")
    .select("id, plan_id, status, fixed_desk_id, plan:plans(name, has_fixed_desk)")
    .eq("user_id", user.id)
    .eq("space_id", spaceId)
    .maybeSingle();

  // Non-members can't book desks — redirect to store for passes
  if (!member || member.status !== "active") {
    redirect("/store");
  }

  const plan = member.plan as unknown as { name: string; has_fixed_desk: boolean | null } | null;

  // Fixed desk members don't need to book
  if (plan?.has_fixed_desk && member.fixed_desk_id) {
    const { data: fixedDesk } = await supabase
      .from("resources")
      .select("name")
      .eq("id", member.fixed_desk_id)
      .single();

    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Desk Booking</h1>
        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          <h3 className="text-base font-medium">You have a fixed desk</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Your assigned desk is <strong>{fixedDesk?.name ?? "your desk"}</strong>.
            No booking needed — it&apos;s always reserved for you.
          </p>
        </div>
      </div>
    );
  }

  // Get space config, credit balance, and availability in parallel
  const limit = getAdvanceBookingLimit();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + limit);
  const endDateStr = endDate.toISOString().slice(0, 10);

  const [
    { data: space },
    { data: creditBalance },
    availability,
    { data: upcomingBookings },
  ] = await Promise.all([
    supabase
      .from("spaces")
      .select("timezone, business_hours")
      .eq("id", spaceId)
      .single(),

    supabase.rpc("get_credit_balance", {
      p_space_id: spaceId,
      p_user_id: user.id,
    }),

    getDeskAvailabilityRange(supabase, spaceId, user.id, todayStr, endDateStr),

    supabase
      .from("bookings")
      .select("id, start_time, end_time, status, resource:resources(name)")
      .eq("user_id", user.id)
      .eq("space_id", spaceId)
      .gte("start_time", todayStr)
      .in("status", ["confirmed", "checked_in"])
      .order("start_time", { ascending: true })
      .limit(10),
  ]);

  const timezone = space?.timezone ?? "Europe/Madrid";
  const businessHours = (space?.business_hours ?? {}) as BusinessHours;

  // Find desk resource type credit info
  const { data: deskType } = await supabase
    .from("resource_types")
    .select("id")
    .eq("slug", "desk")
    .limit(1)
    .maybeSingle();

  const deskCredit = (creditBalance ?? []).find(
    (c: { resource_type_id: string; remaining_minutes: number; is_unlimited: boolean }) =>
      c.resource_type_id === deskType?.id,
  ) as
    | { remaining_minutes: number; is_unlimited: boolean }
    | undefined;

  const isUnlimited = deskCredit?.is_unlimited ?? false;
  const remainingMinutes = deskCredit?.remaining_minutes ?? 0;
  const hasCreditsOrUnlimited = isUnlimited || remainingMinutes > 0;

  // Determine which days of the week are business days
  const businessDays = Object.entries(businessHours)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k]) => k);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Book a Desk</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Select a date to book a hot desk. Desks are auto-assigned.
      </p>

      {/* Credit balance */}
      <div className="mt-6 flex items-center gap-3">
        <div className="rounded-lg border border-border bg-card px-4 py-2.5">
          <span className="text-xs text-muted-foreground">Desk credits</span>
          <div className="mt-0.5 text-lg font-semibold tabular-nums">
            {isUnlimited ? (
              <span className="text-primary">Unlimited</span>
            ) : (
              formatDuration(remainingMinutes)
            )}
          </div>
        </div>
        {!hasCreditsOrUnlimited && (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            No credits remaining.{" "}
            <Link href="/store" className="font-medium underline">
              Purchase more
            </Link>
          </div>
        )}
      </div>

      {/* Calendar */}
      <div className="mt-6">
        <DeskCalendar
          initialAvailability={availability}
          startDate={todayStr}
          endDate={endDateStr}
          businessDays={businessDays}
          timezone={timezone}
          hasCreditsOrUnlimited={hasCreditsOrUnlimited}
        />
      </div>

      {/* Upcoming bookings */}
      {upcomingBookings && upcomingBookings.length > 0 && (
        <div className="mt-8">
          <h2 className="text-base font-semibold">Upcoming Desk Bookings</h2>
          <div className="mt-3 space-y-2">
            {upcomingBookings.map((booking) => {
              const resource = booking.resource as unknown as { name: string } | null;
              const start = new Date(booking.start_time);
              const dateDisplay = new Intl.DateTimeFormat("en-US", {
                timeZone: timezone,
                weekday: "short",
                month: "short",
                day: "numeric",
              }).format(start);
              const timeDisplay = new Intl.DateTimeFormat("en-GB", {
                timeZone: timezone,
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              });

              return (
                <div
                  key={booking.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                >
                  <div>
                    <span className="font-medium">
                      {resource?.name ?? "Desk"}
                    </span>
                    <span className="mx-2 text-muted-foreground">·</span>
                    <span className="text-sm text-muted-foreground">
                      {dateDisplay}
                    </span>
                    <span className="mx-1.5 text-muted-foreground">·</span>
                    <span className="text-sm text-muted-foreground">
                      {timeDisplay.format(start)} – {timeDisplay.format(new Date(booking.end_time))}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      booking.status === "checked_in"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : ""
                    }
                  >
                    {booking.status === "checked_in" ? "Checked in" : "Confirmed"}
                  </Badge>
                </div>
              );
            })}
          </div>
          <Link
            href="/bookings"
            className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
          >
            View all bookings
          </Link>
        </div>
      )}
    </div>
  );
}
