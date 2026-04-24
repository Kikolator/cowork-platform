import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { AdminEventList } from "./admin-event-list";

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filterType = typeof params.type === "string" ? params.type : undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const spaceId = user.app_metadata?.space_id as string | undefined;
  if (!spaceId) redirect("/login");

  // Fetch event types for filter dropdown
  const { data: eventTypes } = await supabase
    .from("event_types")
    .select("slug, description, category")
    .order("category")
    .order("slug");

  // Fetch events — RLS gives admins all events in their space
  let query = supabase
    .from("platform_events")
    .select(
      "id, event_type, actor_id, actor_type, resource_type, resource_id, metadata, created_at, event_types(description, category)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (filterType) {
    query = query.eq("event_type", filterType);
  }

  const { data: events } = await query;

  // Resolve actor names from shared_profiles
  const actorIds = [
    ...new Set(
      (events ?? [])
        .map((e) => e.actor_id)
        .filter((id): id is string => id !== null),
    ),
  ];

  let actorNames: Record<string, string> = {};
  if (actorIds.length > 0) {
    const admin = createAdminClient();
    const { data: profiles } = await admin
      .from("shared_profiles")
      .select("id, full_name, email")
      .in("id", actorIds);

    actorNames = Object.fromEntries(
      (profiles ?? []).map((p) => [
        p.id,
        p.full_name ?? p.email ?? "Unknown",
      ]),
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All events in your space — bookings, billing, admin actions, and more.
        </p>
      </div>

      <AdminEventList
        events={events ?? []}
        eventTypes={eventTypes ?? []}
        actorNames={actorNames}
        currentFilter={filterType}
      />
    </div>
  );
}
