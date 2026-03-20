import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CalendarDays, Clock, ArrowRight, Users } from "lucide-react";

export default async function BookPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const spaceId = user?.app_metadata?.space_id as string | undefined;

  // Fetch bookable resource types with resource counts
  const { data: resourceTypes } = await supabase
    .from("resource_types")
    .select("id, slug, name, resources(count)")
    .eq("bookable", true)
    .order("sort_order", { ascending: true });

  // Fetch today's desk availability
  const today = new Date().toISOString().slice(0, 10);
  const { data: deskAvail } = spaceId
    ? await supabase.rpc("get_desk_availability", {
        p_space_id: spaceId,
        p_date: today,
      })
    : { data: null };

  const deskRow = deskAvail?.[0];

  // Fetch non-desk bookable resources for inline display
  const { data: rooms } = spaceId
    ? await supabase
        .from("resources")
        .select(
          "id, name, capacity, floor, image_url, resource_type_id, resource_type:resource_types!inner(id, slug, name, bookable)",
        )
        .eq("space_id", spaceId)
        .eq("resource_types.bookable", true)
        .neq("resource_types.slug", "desk")
        .eq("status", "available")
        .order("sort_order", { ascending: true })
    : { data: null };

  // Fetch rates for display
  const { data: rates } = spaceId
    ? await supabase
        .from("rate_config")
        .select("resource_type_id, rate_cents, currency")
        .eq("space_id", spaceId)
    : { data: null };

  const rateMap = new Map(
    (rates ?? []).map((r) => [r.resource_type_id, r]),
  );

  // Group rooms by resource type
  const roomsByType = new Map<string, typeof rooms>();
  for (const room of rooms ?? []) {
    const rtId = room.resource_type_id;
    if (!roomsByType.has(rtId)) roomsByType.set(rtId, []);
    roomsByType.get(rtId)!.push(room);
  }

  const deskType = (resourceTypes ?? []).find((rt) => rt.slug === "desk");
  const nonDeskTypes = (resourceTypes ?? []).filter((rt) => rt.slug !== "desk");

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Book a Resource</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Select a resource to make a booking.
      </p>

      {/* Desk card */}
      {deskType && (
        <div className="mt-8">
          <Link
            href="/book/desk"
            className="group flex flex-col rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30 hover:bg-accent/50 sm:max-w-sm"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{deskType.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {deskRow ? (
                <>
                  {deskRow.available_desks}/{deskRow.total_desks} available today
                </>
              ) : (
                <>
                  {(deskType.resources as unknown as { count: number }[])?.[0]?.count ?? 0} desks
                </>
              )}
            </p>
            <div className="mt-4 flex items-center text-sm font-medium text-primary">
              Book a Desk
              <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        </div>
      )}

      {/* Non-desk types with individual rooms */}
      {nonDeskTypes.map((rt) => {
        const typeRooms = roomsByType.get(rt.id) ?? [];
        const rate = rateMap.get(rt.id);
        const pricePerHour = rate
          ? new Intl.NumberFormat("en", {
              style: "currency",
              currency: (rate.currency ?? "eur").toUpperCase(),
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            }).format(rate.rate_cents / 100)
          : null;

        return (
          <div key={rt.id} className="mt-8">
            <h2 className="text-lg font-semibold">{rt.name}</h2>

            {typeRooms.length > 0 ? (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {typeRooms.map((room) => (
                  <Link
                    key={room.id}
                    href={`/book/room/${room.id}`}
                    className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/30 hover:bg-accent/50"
                  >
                    {room.image_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={room.image_url}
                        alt={room.name}
                        className="aspect-[16/9] w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[16/9] w-full items-center justify-center bg-muted">
                        <Clock className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                    )}

                    <div className="p-6">
                      <h3 className="text-lg font-semibold">{room.name}</h3>

                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        {room.capacity && (
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            Capacity: {room.capacity}
                          </span>
                        )}
                        {room.floor !== null && room.floor !== undefined && (
                          <span>· Floor {room.floor}</span>
                        )}
                      </div>

                      {pricePerHour && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {pricePerHour}/hr or use credits
                        </p>
                      )}

                      <div className="mt-4 flex items-center text-sm font-medium text-primary">
                        View Availability
                        <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No rooms available
              </p>
            )}
          </div>
        );
      })}

      {(resourceTypes ?? []).length === 0 && (
        <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <h3 className="text-base font-medium">No bookable resources</h3>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            There are no bookable resource types configured yet. Contact your
            space admin.
          </p>
        </div>
      )}
    </div>
  );
}
