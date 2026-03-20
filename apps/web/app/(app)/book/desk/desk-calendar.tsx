"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBusinessHoursForDate, type BusinessHours } from "@/lib/booking/format";
import { getDeskAvailability } from "./actions";
import { DeskBookingDialog } from "./desk-booking-dialog";

interface DayAvailability {
  available: number;
  total: number;
  closed: boolean;
  userBooked: boolean;
}

interface DeskCalendarProps {
  initialAvailability: Record<string, DayAvailability>;
  startDate: string;
  endDate: string;
  businessDays: string[]; // days of week with business hours (e.g., ["mon","tue","wed","thu","fri"])
  timezone: string;
  hasCreditsOrUnlimited: boolean;
  businessHours: BusinessHours;
  minBookingMinutes: number;
  remainingCreditsMinutes: number;
  isUnlimited: boolean;
}

export function DeskCalendar({
  initialAvailability,
  startDate,
  endDate,
  businessDays,
  timezone,
  hasCreditsOrUnlimited,
  businessHours,
  minBookingMinutes,
  remainingCreditsMinutes,
  isUnlimited,
}: DeskCalendarProps) {
  const [availability, setAvailability] =
    useState<Record<string, DayAvailability>>(initialAvailability);
  const [bookingResult, setBookingResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [dialogDate, setDialogDate] = useState<string | null>(null);

  // Generate dates for the grid
  const dates = generateDates(startDate, endDate);

  // Get today in the space timezone
  const todayStr = formatLocalDate(new Date(), timezone);

  // Group dates by week
  const weeks = groupByWeek(dates, timezone);

  function handleBookClick(date: string) {
    setBookingResult(null);
    setDialogDate(date);
  }

  function handleBooked(result: { deskName: string; startTime: string; endTime: string }) {
    const bookedDate = dialogDate;
    setDialogDate(null);
    setBookingResult({
      type: "success",
      message: `Booked ${result.deskName} for ${bookedDate} (${result.startTime} – ${result.endTime})`,
    });
    startTransition(async () => {
      const updated = await getDeskAvailability(startDate, endDate);
      setAvailability(updated);
    });
  }

  return (
    <div>
      {/* Result banner */}
      {bookingResult && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm ${
            bookingResult.type === "success"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {bookingResult.type === "success" ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : (
            <X className="h-4 w-4 shrink-0" />
          )}
          {bookingResult.message}
          <button
            onClick={() => setBookingResult(null)}
            className="ml-auto text-current opacity-60 hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Calendar grid */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* Day headers */}
        <div className="grid grid-cols-5 border-b border-border bg-muted/50">
          {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => (
            <div
              key={day}
              className="px-3 py-2 text-center text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-5 divide-x divide-border">
            {week.map((day, di) => {
              if (!day) {
                return <div key={di} className="min-h-[88px] bg-muted/20" />;
              }

              const avail = availability[day.dateStr];
              const isPast = day.dateStr < todayStr;
              const isClosed = avail?.closed ?? false;
              const isBooked = avail?.userBooked ?? false;
              const isFull = (avail?.available ?? 0) <= 0;

              const isDisabled =
                isPast || isClosed || isFull || isPending || !hasCreditsOrUnlimited;

              return (
                <div
                  key={di}
                  className={`min-h-[88px] p-2 transition-colors ${
                    isPast
                      ? "bg-muted/30"
                      : isClosed
                        ? "bg-muted/20"
                        : isBooked
                          ? "bg-primary/5"
                          : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-sm font-medium ${
                        day.dateStr === todayStr
                          ? "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                          : isPast
                            ? "text-muted-foreground"
                            : ""
                      }`}
                    >
                      {day.dayNum}
                    </span>
                  </div>

                  <div className="mt-1">
                    {isClosed ? (
                      <span className="text-[11px] text-muted-foreground">
                        Closed
                      </span>
                    ) : isPast ? (
                      <span className="text-[11px] text-muted-foreground">
                        Past
                      </span>
                    ) : (
                      <>
                        {isBooked && (
                          <div className="flex items-center gap-1">
                            <Check className="h-3 w-3 text-primary" />
                            <span className="text-[11px] font-medium text-primary">
                              Booked
                            </span>
                          </div>
                        )}
                        {!isBooked && (
                          <span className="text-[11px] text-muted-foreground">
                            {avail?.available ?? 0}/{avail?.total ?? 0}
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant={isFull ? "outline" : "default"}
                          className="mt-1 h-6 w-full text-[11px]"
                          disabled={isDisabled}
                          onClick={() => handleBookClick(day.dateStr)}
                        >
                          {isFull ? "Full" : "Book"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Booking dialog */}
      {dialogDate && (() => {
        const hours = getBusinessHoursForDate(businessHours, dialogDate, timezone);
        if (!hours) return null;
        return (
          <DeskBookingDialog
            open
            onOpenChange={(isOpen) => { if (!isOpen) setDialogDate(null); }}
            date={dialogDate}
            businessOpen={hours.open}
            businessClose={hours.close}
            minBookingMinutes={minBookingMinutes}
            remainingCreditsMinutes={remainingCreditsMinutes}
            isUnlimited={isUnlimited}
            onBooked={handleBooked}
          />
        );
      })()}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────

function generateDates(
  startDate: string,
  endDate: string,
): { dateStr: string; dayNum: number }[] {
  const dates: { dateStr: string; dayNum: number }[] = [];
  const current = new Date(startDate + "T12:00:00Z");
  const end = new Date(endDate + "T12:00:00Z");

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    dates.push({ dateStr, dayNum: current.getUTCDate() });
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function formatLocalDate(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function getDayOfWeek(dateStr: string): number {
  // 0 = Sun, 1 = Mon, ... 6 = Sat
  return new Date(dateStr + "T12:00:00Z").getUTCDay();
}

function groupByWeek(
  dates: { dateStr: string; dayNum: number }[],
  _timezone: string,
): (({ dateStr: string; dayNum: number } | null)[])[] {
  const weeks: (({ dateStr: string; dayNum: number } | null)[])[] = [];
  let currentWeek: ({ dateStr: string; dayNum: number } | null)[] = [];

  // Filter to only weekdays (Mon-Fri)
  const weekdays = dates.filter((d) => {
    const dow = getDayOfWeek(d.dateStr);
    return dow >= 1 && dow <= 5;
  });

  for (const day of weekdays) {
    const dow = getDayOfWeek(day.dateStr); // 1=Mon, 5=Fri
    const colIdx = dow - 1; // 0=Mon, 4=Fri

    // Start a new week if needed
    if (currentWeek.length === 0 && colIdx > 0) {
      // Pad the start of the first week
      for (let i = 0; i < colIdx; i++) {
        currentWeek.push(null);
      }
    }

    // If we'd exceed 5 columns, start new week
    if (currentWeek.length >= 5) {
      weeks.push(currentWeek);
      currentWeek = [];
      // Pad if the day doesn't start on Monday
      for (let i = 0; i < colIdx; i++) {
        currentWeek.push(null);
      }
    }

    currentWeek.push(day);
  }

  // Pad and push the last week
  if (currentWeek.length > 0) {
    while (currentWeek.length < 5) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  return weeks;
}
