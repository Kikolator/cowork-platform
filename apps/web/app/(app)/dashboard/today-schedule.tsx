import Link from "next/link";
import { Clock } from "lucide-react";
import { formatTimeRange } from "@/lib/booking/format";

const STATUS_STYLES = {
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  checked_in: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  completed: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
} as const;

const STATUS_LABELS = {
  confirmed: "Confirmed",
  checked_in: "Checked in",
  completed: "Completed",
} as const;

interface TodayBooking {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  resource: {
    name: string;
    resource_type: { name: string; slug: string };
  };
}

export function TodaySchedule({
  bookings,
  timezone,
}: {
  bookings: TodayBooking[];
  timezone: string;
}) {
  if (bookings.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-medium text-foreground">Today</h3>
        <div className="mt-3 rounded-xl border border-dashed border-border bg-card px-6 py-8 text-center">
          <Clock className="mx-auto h-6 w-6 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">
            No bookings today.{" "}
            <Link href="/book" className="text-primary hover:underline">
              Book a space
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-medium text-foreground">Today</h3>
      <div className="mt-3 overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--glass-shadow)] backdrop-blur-xl">
        {bookings.map((booking) => {
          const status = booking.status as keyof typeof STATUS_STYLES;
          return (
            <div
              key={booking.id}
              className="flex items-center gap-4 border-b border-[var(--glass-border)] px-4 py-3 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {booking.resource.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {booking.resource.resource_type.name} &middot;{" "}
                  {formatTimeRange(booking.start_time, booking.end_time, timezone)}
                </p>
              </div>
              {STATUS_STYLES[status] && (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
                >
                  {STATUS_LABELS[status]}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
