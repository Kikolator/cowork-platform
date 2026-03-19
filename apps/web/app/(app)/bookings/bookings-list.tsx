"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cancelBooking, checkIn, checkOut } from "./actions";
import { formatCredits } from "@/lib/booking/format";

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  credits_deducted: number | null;
  resource: {
    name: string;
    resource_type: { name: string; slug: string };
  };
}

interface BookingsListProps {
  upcoming: Booking[];
  past: Booking[];
  timezone: string;
}

const STATUS_STYLES: Record<string, string> = {
  confirmed: "",
  checked_in:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  completed:
    "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400",
  cancelled:
    "border-red-200 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400",
  no_show:
    "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400",
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  checked_in: "Checked In",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
};

export function BookingsList({ upcoming, past, timezone }: BookingsListProps) {
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    if (!cancelTarget) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelBooking(cancelTarget.id);
      if (result.success) {
        setCancelTarget(null);
      } else {
        setError(result.error);
      }
    });
  }

  function handleCheckIn(bookingId: string) {
    startTransition(async () => {
      const result = await checkIn(bookingId);
      if (!result.success) {
        setError(result.error);
      }
    });
  }

  function handleCheckOut(bookingId: string) {
    startTransition(async () => {
      const result = await checkOut(bookingId);
      if (!result.success) {
        setError(result.error);
      }
    });
  }

  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const dateFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  // Determine if today for check-in availability
  const now = new Date();

  function isCheckInAvailable(booking: Booking): boolean {
    if (booking.status !== "confirmed") return false;
    const start = new Date(booking.start_time);
    const end = new Date(booking.end_time);
    const windowStart = new Date(start.getTime() - 15 * 60_000);
    return now >= windowStart && now <= end;
  }

  function renderBookingCard(booking: Booking, showActions: boolean) {
    const start = new Date(booking.start_time);
    const end = new Date(booking.end_time);
    const icon = booking.resource.resource_type.slug === "desk" ? "desk" : "room";

    return (
      <div
        key={booking.id}
        className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{booking.resource.name}</span>
            <span className="text-xs text-muted-foreground">
              {booking.resource.resource_type.name}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>{dateFmt.format(start)}</span>
            <span>·</span>
            <span className="tabular-nums">
              {timeFmt.format(start)} – {timeFmt.format(end)}
            </span>
            {booking.credits_deducted !== null && booking.credits_deducted > 0 && (
              <>
                <span>·</span>
                <span>{formatCredits(booking.credits_deducted)}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={STATUS_STYLES[booking.status] ?? ""}
          >
            {STATUS_LABELS[booking.status] ?? booking.status}
          </Badge>

          {showActions && (
            <>
              {booking.status === "confirmed" && isCheckInAvailable(booking) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCheckIn(booking.id)}
                  disabled={isPending}
                  className="h-7 text-xs"
                >
                  Check In
                </Button>
              )}

              {booking.status === "checked_in" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCheckOut(booking.id)}
                  disabled={isPending}
                  className="h-7 text-xs"
                >
                  Check Out
                </Button>
              )}

              {(booking.status === "confirmed" || booking.status === "checked_in") && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCancelTarget(booking)}
                  disabled={isPending}
                  className="h-7 text-xs text-destructive hover:text-destructive"
                >
                  Cancel
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 ? (
        <div>
          <h2 className="text-base font-semibold">Upcoming</h2>
          <div className="mt-3 space-y-2">
            {upcoming.map((b) => renderBookingCard(b, true))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
          <h3 className="text-base font-medium">No upcoming bookings</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Book a desk or room to get started.
          </p>
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div className="mt-8">
          <h2 className="text-base font-semibold text-muted-foreground">
            Past Bookings
          </h2>
          <div className="mt-3 space-y-2">
            {past.map((b) => renderBookingCard(b, false))}
          </div>
        </div>
      )}

      {/* Cancel dialog */}
      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) {
            setCancelTarget(null);
            setError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Cancel your booking for{" "}
              <strong>{cancelTarget?.resource.name}</strong> on{" "}
              {cancelTarget ? dateFmt.format(new Date(cancelTarget.start_time)) : ""}?
              Credits will be refunded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep booking</AlertDialogCancel>
            <Button
              onClick={handleCancel}
              disabled={isPending}
              variant="destructive"
            >
              {isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Cancel booking
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
