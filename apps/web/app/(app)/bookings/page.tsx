import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BookingsList } from "./bookings-list";
import { Button } from "@/components/ui/button";
import { CalendarPlus } from "lucide-react";

export default async function BookingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const spaceId = user.app_metadata?.space_id as string | undefined;
  if (!spaceId) redirect("/");

  const now = new Date().toISOString();

  // Fetch upcoming and past bookings in parallel, plus space timezone
  const [{ data: upcoming }, { data: past }, { data: space }] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, start_time, end_time, status, credits_deducted, resource:resources!inner(name, resource_type:resource_types!inner(name, slug))",
      )
      .eq("user_id", user.id)
      .eq("space_id", spaceId)
      .gte("start_time", now)
      .in("status", ["confirmed", "checked_in"])
      .order("start_time", { ascending: true })
      .limit(20),

    supabase
      .from("bookings")
      .select(
        "id, start_time, end_time, status, credits_deducted, resource:resources!inner(name, resource_type:resource_types!inner(name, slug))",
      )
      .eq("user_id", user.id)
      .eq("space_id", spaceId)
      .lt("start_time", now)
      .order("start_time", { ascending: false })
      .limit(20),

    supabase.from("spaces").select("timezone").eq("id", spaceId).single(),
  ]);

  const timezone = space?.timezone ?? "Europe/Madrid";

  // Cast the nested resource types
  const castBookings = (
    bookings: typeof upcoming,
  ) =>
    (bookings ?? []).map((b) => ({
      ...b,
      resource: b.resource as unknown as {
        name: string;
        resource_type: { name: string; slug: string };
      },
    }));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Bookings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View and manage your upcoming and past bookings.
          </p>
        </div>
        <Button render={<Link href="/book" />}>
          <CalendarPlus className="mr-1.5 h-4 w-4" />
          Book
        </Button>
      </div>

      <div className="mt-6">
        <BookingsList
          upcoming={castBookings(upcoming)}
          past={castBookings(past)}
          timezone={timezone}
        />
      </div>
    </div>
  );
}
