import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Clock, ArrowRight, Users } from "lucide-react";

export default async function RoomSelectionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const spaceId = user?.app_metadata?.space_id as string | undefined;

  // Fetch all non-desk bookable resources with their types and rates
  const { data: rooms } = await supabase
    .from("resources")
    .select(
      "id, name, capacity, floor, image_url, resource_type:resource_types!inner(id, slug, name, bookable)",
    )
    .eq("space_id", spaceId!)
    .eq("resource_types.bookable", true)
    .neq("resource_types.slug", "desk")
    .eq("status", "available")
    .order("sort_order", { ascending: true });

  // Fetch rates for display
  const { data: rates } = await supabase
    .from("rate_config")
    .select("resource_type_id, rate_cents, currency")
    .eq("space_id", spaceId!);

  const rateMap = new Map(
    (rates ?? []).map((r) => [r.resource_type_id, r]),
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Book a Room</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Select a room to view available time slots.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {(rooms ?? []).map((room) => {
          const rt = room.resource_type as unknown as {
            id: string;
            slug: string;
            name: string;
          };
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
                    <span>
                      · Floor {room.floor}
                    </span>
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
          );
        })}
      </div>

      {(rooms ?? []).length === 0 && (
        <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <h3 className="text-base font-medium">No rooms available</h3>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            There are no bookable rooms configured. Contact your space admin.
          </p>
        </div>
      )}
    </div>
  );
}
