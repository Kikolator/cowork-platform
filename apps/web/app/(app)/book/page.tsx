import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CalendarDays, Clock, ArrowRight } from "lucide-react";

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

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Book a Resource</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Select a resource type to make a booking.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(resourceTypes ?? []).map((rt) => {
          const isDesk = rt.slug === "desk";
          const href = isDesk ? "/book/desk" : "/book/room";
          const count = (rt.resources as unknown as { count: number }[])?.[0]?.count ?? 0;

          return (
            <Link
              key={rt.id}
              href={href}
              className="group relative flex flex-col rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30 hover:bg-accent/50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                {isDesk ? (
                  <CalendarDays className="h-5 w-5 text-primary" />
                ) : (
                  <Clock className="h-5 w-5 text-primary" />
                )}
              </div>

              <h3 className="mt-4 text-lg font-semibold">{rt.name}</h3>

              <p className="mt-1 text-sm text-muted-foreground">
                {isDesk ? (
                  deskRow ? (
                    <>
                      {deskRow.available_desks}/{deskRow.total_desks} available today
                    </>
                  ) : (
                    <>{count} desks</>
                  )
                ) : (
                  <>
                    {count} {count === 1 ? "room" : "rooms"}
                  </>
                )}
              </p>

              <div className="mt-4 flex items-center text-sm font-medium text-primary">
                {isDesk ? "Book a Desk" : "Book a Room"}
                <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          );
        })}
      </div>

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
