import { createClient } from "@/lib/supabase/server";
import { DailyView } from "./daily-view";
import { BookingsTable } from "./bookings-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function AdminBookingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const spaceId = user?.app_metadata?.space_id as string | undefined;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch space, today's bookings, all recent bookings, passes, and fixed desk members
  const [
    { data: space },
    { data: todayBookings },
    { data: allBookings },
    { data: todayPasses },
    { data: fixedDeskMembers },
  ] = await Promise.all([
    supabase.from("spaces").select("timezone").eq("id", spaceId!).single(),

    // Today's bookings for daily view
    supabase
      .from("bookings")
      .select(
        "id, user_id, start_time, end_time, status, checked_in_at, checked_out_at, credits_deducted, resource:resources!inner(id, name, resource_type:resource_types!inner(slug, name))",
      )
      .eq("space_id", spaceId!)
      .gte("start_time", today + "T00:00:00Z")
      .lt("start_time", today + "T23:59:59Z")
      .in("status", ["confirmed", "checked_in", "completed"])
      .order("start_time", { ascending: true }),

    // Recent bookings for table view (last 30 days + upcoming)
    supabase
      .from("bookings")
      .select(
        "id, user_id, start_time, end_time, status, credits_deducted, resource:resources!inner(name, resource_type:resource_types!inner(slug, name))",
      )
      .eq("space_id", spaceId!)
      .gte("start_time", thirtyDaysAgo)
      .order("start_time", { ascending: false })
      .limit(200),

    // Active passes covering today
    supabase
      .from("passes")
      .select("id, user_id, pass_type, status, start_date, end_date, assigned_desk_id")
      .eq("space_id", spaceId!)
      .eq("status", "active")
      .lte("start_date", today)
      .gte("end_date", today),

    // Active members with fixed desks
    supabase
      .from("members")
      .select("id, user_id, fixed_desk_id")
      .eq("space_id", spaceId!)
      .eq("status", "active")
      .not("fixed_desk_id", "is", null),
  ]);

  const timezone = space?.timezone ?? "Europe/Madrid";

  // Resolve desk names for passes and fixed desk members
  const deskIds = new Set<string>();
  for (const p of todayPasses ?? []) {
    if (p.assigned_desk_id) deskIds.add(p.assigned_desk_id);
  }
  for (const m of fixedDeskMembers ?? []) {
    if (m.fixed_desk_id) deskIds.add(m.fixed_desk_id as string);
  }

  const { data: deskResources } = deskIds.size > 0
    ? await supabase.from("resources").select("id, name").in("id", [...deskIds])
    : { data: [] as { id: string; name: string }[] };

  const deskNameMap = Object.fromEntries(
    (deskResources ?? []).map((r) => [r.id, r.name]),
  );

  // Collect unique user IDs from all data sets
  const allUserIds = new Set<string>();
  for (const b of todayBookings ?? []) allUserIds.add(b.user_id);
  for (const b of allBookings ?? []) allUserIds.add(b.user_id);
  for (const p of todayPasses ?? []) allUserIds.add(p.user_id);
  for (const m of fixedDeskMembers ?? []) allUserIds.add(m.user_id);

  // Fetch profiles
  const userIds = [...allUserIds];
  const { data: profiles } = userIds.length > 0
    ? await supabase
        .from("shared_profiles")
        .select("id, full_name, email")
        .in("id", userIds)
    : { data: [] as { id: string; full_name: string | null; email: string }[] };

  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, { full_name: p.full_name, email: p.email }]),
  );

  // Cast resource types
  type BookingRow = NonNullable<typeof todayBookings>[number];
  const castBookings = (list: BookingRow[] | null) =>
    (list ?? []).map((b) => ({
      ...b,
      resource: b.resource as unknown as {
        id: string;
        name: string;
        resource_type: { slug: string; name: string };
      },
    }));

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">All Bookings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage bookings, check-ins, and view daily occupancy.
      </p>

      <Tabs defaultValue="daily" className="mt-6">
        <TabsList>
          <TabsTrigger value="daily">Daily View</TabsTrigger>
          <TabsTrigger value="table">All Bookings</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-4">
          <DailyView
            initialBookings={castBookings(todayBookings)}
            initialPasses={(todayPasses ?? []).map((p) => ({
              ...p,
              desk_name: p.assigned_desk_id ? deskNameMap[p.assigned_desk_id] ?? null : null,
            }))}
            initialFixedDeskMembers={(fixedDeskMembers ?? []).map((m) => ({
              ...m,
              desk_name: m.fixed_desk_id ? deskNameMap[m.fixed_desk_id as string] ?? null : null,
            }))}
            initialProfileMap={profileMap}
            initialDate={today}
            timezone={timezone}
          />
        </TabsContent>

        <TabsContent value="table" className="mt-4">
          <BookingsTable
            bookings={castBookings(allBookings as BookingRow[] | null)}
            profileMap={profileMap}
            timezone={timezone}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
