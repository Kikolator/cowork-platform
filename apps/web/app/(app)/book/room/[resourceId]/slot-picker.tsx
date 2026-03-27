"use client";

import { useState, useTransition } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCredits } from "@/lib/booking/format";
import { getRoomAvailability, bookRoom } from "../actions";

interface TimeSlot {
  slotStart: string;
  slotEnd: string;
  isAvailable: boolean;
}

interface SlotPickerProps {
  resourceId: string;
  resourceName: string;
  initialSlots: TimeSlot[];
  initialDate: string;
  timezone: string;
  remainingCreditsMinutes: number;
  isUnlimited: boolean;
}

export function SlotPicker({
  resourceId,
  resourceName,
  initialSlots,
  initialDate,
  timezone,
  remainingCreditsMinutes,
  isUnlimited,
}: SlotPickerProps) {
  const [date, setDate] = useState(initialDate);
  const [slots, setSlots] = useState<TimeSlot[]>(initialSlots);
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<number | null>(null);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const availableSlots = slots.filter((s) => s.isAvailable);

  // Selection handling
  const selectedRange =
    selectedStart !== null && selectedEnd !== null
      ? { start: Math.min(selectedStart, selectedEnd), end: Math.max(selectedStart, selectedEnd) }
      : selectedStart !== null
        ? { start: selectedStart, end: selectedStart }
        : null;

  // Check if all slots in range are available
  const isRangeValid =
    selectedRange !== null &&
    slots
      .slice(selectedRange.start, selectedRange.end + 1)
      .every((s) => s.isAvailable);

  const selectedDuration = selectedRange
    ? (selectedRange.end - selectedRange.start + 1) * 30
    : 0;

  const hasEnoughCredits =
    isUnlimited || remainingCreditsMinutes >= selectedDuration;

  // Format time from ISO string
  function formatSlotTime(isoStr: string): string {
    const d = new Date(isoStr);
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  }

  // Navigate dates
  function changeDate(delta: number) {
    const d = new Date(date + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + delta);
    const newDate = d.toISOString().slice(0, 10);
    setDate(newDate);
    setSelectedStart(null);
    setSelectedEnd(null);
    setResult(null);

    startTransition(async () => {
      const newSlots = await getRoomAvailability(resourceId, newDate);
      setSlots(newSlots);
    });
  }

  function handleSlotClick(index: number) {
    if (!slots[index]?.isAvailable) return;

    if (selectedStart === null) {
      setSelectedStart(index);
      setSelectedEnd(null);
    } else if (selectedEnd === null) {
      // Ensure contiguous available range
      const start = Math.min(selectedStart, index);
      const end = Math.max(selectedStart, index);
      const allAvailable = slots
        .slice(start, end + 1)
        .every((s) => s.isAvailable);

      if (allAvailable) {
        setSelectedEnd(index);
      } else {
        // Reset to new single selection
        setSelectedStart(index);
        setSelectedEnd(null);
      }
    } else {
      // Third click resets
      setSelectedStart(index);
      setSelectedEnd(null);
    }
  }

  function handleBooking() {
    if (!selectedRange || !isRangeValid || !hasEnoughCredits) return;

    const startSlot = slots[selectedRange.start]!;
    const endSlot = slots[selectedRange.end]!;
    setResult(null);

    startTransition(async () => {
      const res = await bookRoom(
        resourceId,
        startSlot.slotStart,
        endSlot.slotEnd,
      );

      if (res.success) {
        setResult({ type: "success", message: "Room booked successfully!" });
        setSelectedStart(null);
        setSelectedEnd(null);
        // Refresh slots
        const newSlots = await getRoomAvailability(resourceId, date);
        setSlots(newSlots);
      } else {
        setResult({ type: "error", message: res.error });
      }
    });
  }

  // Date display
  const dateDisplay = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(date + "T12:00:00Z"));

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {resourceName} — {dateDisplay}
        </h2>
      </div>

      {/* Credits */}
      <div className="mb-4 rounded-lg border border-border bg-card px-4 py-2.5">
        <span className="text-xs text-muted-foreground">Your credits: </span>
        <span className="text-sm font-semibold">
          {isUnlimited
            ? "Unlimited"
            : `${formatCredits(remainingCreditsMinutes)} remaining`}
        </span>
      </div>

      {/* Date navigation */}
      <div className="mb-4 flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => changeDate(-1)}
          disabled={isPending}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[120px] text-center text-sm font-medium">
          {new Intl.DateTimeFormat("en-US", {
            timeZone: timezone,
            month: "short",
            day: "numeric",
          }).format(new Date(date + "T12:00:00Z"))}
        </span>
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => changeDate(1)}
          disabled={isPending}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Result banner */}
      {result && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm ${
            result.type === "success"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {result.type === "success" ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : (
            <X className="h-4 w-4 shrink-0" />
          )}
          {result.message}
          <button
            onClick={() => setResult(null)}
            className="ml-auto text-current opacity-60 hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Slot grid */}
      {slots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {isPending ? "Loading..." : "No slots available on this date"}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {slots.map((slot, i) => {
            const isSelected =
              selectedRange !== null &&
              i >= selectedRange.start &&
              i <= selectedRange.end;
            const isFirst = isSelected && i === selectedRange!.start;
            const isLast = isSelected && i === selectedRange!.end;

            return (
              <button
                key={slot.slotStart}
                onClick={() => handleSlotClick(i)}
                disabled={!slot.isAvailable || isPending}
                className={`flex w-full items-center justify-between border-b border-border px-4 py-2.5 text-sm transition-colors last:border-b-0 ${
                  !slot.isAvailable
                    ? "cursor-not-allowed bg-muted/40 text-muted-foreground"
                    : isSelected
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-accent/50"
                }`}
              >
                <span className="font-medium tabular-nums">
                  {formatSlotTime(slot.slotStart)}
                </span>
                <span>
                  {!slot.isAvailable ? (
                    <span className="text-xs text-muted-foreground">Booked</span>
                  ) : isSelected ? (
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Available
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Selection summary + Book button */}
      {selectedRange !== null && isRangeValid && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
          <div>
            <span className="text-sm font-medium">
              {formatSlotTime(slots[selectedRange.start]!.slotStart)} –{" "}
              {formatSlotTime(slots[selectedRange.end]!.slotEnd)}
            </span>
            <span className="ml-2 text-sm text-muted-foreground">
              ({Math.floor(selectedDuration / 60) > 0 ? `${Math.floor(selectedDuration / 60)}h ` : ""}
              {selectedDuration % 60 > 0 ? `${selectedDuration % 60}m` : ""})
            </span>
            {!isUnlimited && (
              <span className="ml-2 text-sm text-muted-foreground">
                — {formatCredits(selectedDuration)}
              </span>
            )}
          </div>
          <Button
            onClick={handleBooking}
            disabled={isPending || !hasEnoughCredits}
            size="sm"
          >
            {isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : null}
            {hasEnoughCredits ? "Book Now" : "Insufficient Credits"}
          </Button>
        </div>
      )}

      {selectedRange !== null && !hasEnoughCredits && (
        <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
          You need {formatCredits(selectedDuration)} but have {formatCredits(remainingCreditsMinutes)}.{" "}
          <a href="/store" className="font-medium underline">
            Purchase an hour bundle
          </a>
        </p>
      )}
    </div>
  );
}
