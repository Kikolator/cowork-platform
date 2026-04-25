import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EventList } from "./event-list";

export default async function ActivityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // RLS filters automatically: members see only their own tenant-visible events
  const { data: events } = await supabase
    .from("platform_events")
    .select(
      "id, event_type, resource_type, resource_id, metadata, created_at, event_types(description, category)",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your recent activity in this space.
        </p>
      </div>

      <EventList events={events ?? []} />
    </div>
  );
}
