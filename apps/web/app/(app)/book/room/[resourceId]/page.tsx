import { redirect, notFound } from "next/navigation";
import { createLogger } from "@cowork/shared";
import { createClient } from "@/lib/supabase/server";
import { getRoomSlots, type TimeSlot } from "@/lib/booking/availability";
import { formatDuration } from "@/lib/booking/format";
import { SlotPicker } from "./slot-picker";

interface PageProps {
  params: Promise<{ resourceId: string }>;
  searchParams: Promise<{ date?: string }>;
}

export default async function RoomBookingPage({ params, searchParams }: PageProps) {
  const { resourceId } = await params;
  const { date: dateParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const spaceId = user.app_metadata?.space_id as string | undefined;
  if (!spaceId) redirect("/");

  const today = new Date().toISOString().slice(0, 10);
  const date = dateParam ?? today;

  // Fetch resource, space, member credit balance in parallel
  let resource, space, member;
  try {
    [{ data: resource }, { data: space }, { data: member }] = await Promise.all([
      supabase
        .from("resources")
        .select("id, name, capacity, floor, image_url, resource_type_id, resource_type:resource_types!inner(id, slug, name)")
        .eq("id", resourceId)
        .eq("space_id", spaceId)
        .single(),

      supabase
        .from("spaces")
        .select("timezone, business_hours")
        .eq("id", spaceId)
        .single(),

      supabase
        .from("members")
        .select("id, plan_id, status")
        .eq("user_id", user.id)
        .eq("space_id", spaceId)
        .eq("status", "active")
        .maybeSingle(),
    ]);
  } catch (err) {
    createLogger({ component: "book/room" }).error("Failed to load room booking data", {
      error: err instanceof Error ? err.message : "Unknown error",
    });
    throw err; // Let error boundary handle it
  }

  if (!resource) notFound();

  const timezone = space?.timezone ?? "Europe/Madrid";
  const rt = resource.resource_type as unknown as { id: string; slug: string; name: string };

  // Fetch slots and credit balance in parallel
  let slots: TimeSlot[], creditBalance;
  try {
    [slots, { data: creditBalance }] = await Promise.all([
      getRoomSlots(supabase, spaceId, resourceId, date),
      supabase.rpc("get_credit_balance", {
        p_space_id: spaceId,
        p_user_id: user.id,
      }),
    ]);
  } catch (err) {
    createLogger({ component: "book/room" }).error("Failed to load slots/credits", {
      error: err instanceof Error ? err.message : "Unknown error",
    });
    slots = [];
    creditBalance = null;
  }

  // Find credits for this resource type
  const credit = (creditBalance ?? []).find(
    (c: { resource_type_id: string }) => c.resource_type_id === rt.id,
  ) as
    | { remaining_minutes: number; is_unlimited: boolean }
    | undefined;

  const isUnlimited = credit?.is_unlimited ?? false;
  const remainingMinutes = credit?.remaining_minutes ?? 0;

  return (
    <div>
      {resource.image_url && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={resource.image_url}
          alt={resource.name}
          className="mb-6 aspect-[21/9] w-full rounded-xl object-cover"
        />
      )}

      <h1 className="text-2xl font-semibold tracking-tight">{resource.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {rt.name}
        {resource.capacity ? ` · Capacity: ${resource.capacity}` : ""}
        {resource.floor !== null ? ` · Floor ${resource.floor}` : ""}
      </p>

      <div className="mt-6">
        <SlotPicker
          resourceId={resourceId}
          resourceName={resource.name}
          initialSlots={slots}
          initialDate={date}
          timezone={timezone}
          remainingCreditsMinutes={remainingMinutes}
          isUnlimited={isUnlimited}
        />
      </div>
    </div>
  );
}
