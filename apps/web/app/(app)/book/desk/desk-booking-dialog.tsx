"use client";

import { useState, useMemo, useTransition, useEffect, useCallback } from "react";
import { Loader2, Clock, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatDuration, formatCredits } from "@/lib/booking/format";
import { bookDesk, getAvailableDesks } from "./actions";

interface DeskBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  businessOpen: string; // "09:00"
  businessClose: string; // "18:00"
  minBookingMinutes: number;
  remainingCreditsMinutes: number;
  isUnlimited: boolean;
  onBooked: (result: {
    deskName: string;
    startTime: string;
    endTime: string;
  }) => void;
}

function generateTimeSlots(open: string, close: string): string[] {
  const [openH, openM] = open.split(":").map(Number) as [number, number];
  const [closeH, closeM] = close.split(":").map(Number) as [number, number];
  const openMin = openH * 60 + openM;
  const closeMin = closeH * 60 + closeM;

  const slots: string[] = [];
  for (let m = openMin; m <= closeMin; m += 30) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`);
  }
  return slots;
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function DeskBookingDialog({
  open,
  onOpenChange,
  date,
  businessOpen,
  businessClose,
  minBookingMinutes,
  remainingCreditsMinutes,
  isUnlimited,
  onBooked,
}: DeskBookingDialogProps) {
  const [startTime, setStartTime] = useState(businessOpen);
  const [endTime, setEndTime] = useState(businessClose);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [availableDesks, setAvailableDesks] = useState<{ id: string; name: string }[]>([]);
  const [selectedDeskId, setSelectedDeskId] = useState<string | null>(null);
  const [isLoadingDesks, setIsLoadingDesks] = useState(false);

  const allSlots = useMemo(
    () => generateTimeSlots(businessOpen, businessClose),
    [businessOpen, businessClose],
  );

  // End time options: must be after start time + min duration
  const endSlots = useMemo(() => {
    const [startH, startM] = startTime.split(":").map(Number) as [number, number];
    const startMin = startH * 60 + startM;
    const minEnd = startMin + minBookingMinutes;
    return allSlots.filter((slot) => {
      const [h, m] = slot.split(":").map(Number) as [number, number];
      return h * 60 + m >= minEnd;
    });
  }, [allSlots, startTime, minBookingMinutes]);

  // Duration in minutes
  const durationMinutes = useMemo(() => {
    const [sH, sM] = startTime.split(":").map(Number) as [number, number];
    const [eH, eM] = endTime.split(":").map(Number) as [number, number];
    return (eH * 60 + eM) - (sH * 60 + sM);
  }, [startTime, endTime]);

  const isValidDuration = durationMinutes >= minBookingMinutes;
  const hasEnoughCredits = isUnlimited || remainingCreditsMinutes >= durationMinutes;

  const fetchDesks = useCallback(async (s: string, e: string) => {
    setIsLoadingDesks(true);
    setSelectedDeskId(null);
    try {
      const desks = await getAvailableDesks(date, s, e);
      setAvailableDesks(desks);
      if (desks.length > 0) setSelectedDeskId(desks[0].id);
    } finally {
      setIsLoadingDesks(false);
    }
  }, [date]);

  // Fetch available desks when times change
  useEffect(() => {
    if (!isValidDuration) return;
    fetchDesks(startTime, endTime);
  }, [startTime, endTime, isValidDuration, fetchDesks]);

  // When start changes, ensure end is still valid
  function handleStartChange(value: string) {
    setStartTime(value);
    setError(null);

    const [sH, sM] = value.split(":").map(Number) as [number, number];
    const [eH, eM] = endTime.split(":").map(Number) as [number, number];
    const startMin = sH * 60 + sM;
    const endMin = eH * 60 + eM;
    const minEnd = startMin + minBookingMinutes;

    if (endMin < minEnd) {
      // Snap end time to the nearest valid slot
      const nextValid = allSlots.find((slot) => {
        const [h, m] = slot.split(":").map(Number) as [number, number];
        return h * 60 + m >= minEnd;
      });
      if (nextValid) setEndTime(nextValid);
      else setEndTime(businessClose);
    }
  }

  function handleSubmit() {
    if (!selectedDeskId) return;
    setError(null);

    const deskName = availableDesks.find((d) => d.id === selectedDeskId)?.name ?? "Desk";

    startTransition(async () => {
      const result = await bookDesk(date, startTime, endTime, selectedDeskId);

      if (result.success) {
        onBooked({
          deskName,
          startTime: result.startTime,
          endTime: result.endTime,
        });
        // Reset for next use
        setStartTime(businessOpen);
        setEndTime(businessClose);
        setSelectedDeskId(null);
        setAvailableDesks([]);
      } else {
        setError(result.error);
      }
    });
  }

  // Reset times when dialog opens
  function handleOpenChange(isOpen: boolean) {
    if (isOpen) {
      setStartTime(businessOpen);
      setEndTime(businessClose);
      setError(null);
      setAvailableDesks([]);
      setSelectedDeskId(null);
    }
    onOpenChange(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Book a Desk</DialogTitle>
          <DialogDescription>
            {formatDateDisplay(date)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Start time</Label>
              <Select value={startTime} onValueChange={(v) => v && handleStartChange(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allSlots.slice(0, -1).map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>End time</Label>
              <Select value={endTime} onValueChange={(v) => { if (v) { setEndTime(v); setError(null); } }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {endSlots.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Duration & credit cost */}
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>
              Duration: <strong>{formatDuration(durationMinutes)}</strong>
            </span>
            {!isUnlimited && (
              <>
                <span className="text-muted-foreground">·</span>
                <span>
                  Cost: <strong>{formatCredits(durationMinutes)}</strong>
                </span>
              </>
            )}
          </div>

          {/* Desk selection */}
          {isValidDuration && (
            <div className="grid gap-2">
              <Label>Select a desk</Label>
              {isLoadingDesks ? (
                <div className="flex items-center justify-center py-3 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading desks…
                </div>
              ) : availableDesks.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">
                  No desks available for this time slot
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {availableDesks.map((desk) => (
                    <button
                      key={desk.id}
                      type="button"
                      onClick={() => setSelectedDeskId(desk.id)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        selectedDeskId === desk.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <Monitor className="h-4 w-4 shrink-0" />
                      {desk.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Insufficient credits warning */}
          {!hasEnoughCredits && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Not enough credits. You have {formatCredits(remainingCreditsMinutes)} remaining.
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !isValidDuration || !hasEnoughCredits || !selectedDeskId}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Book Desk
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
