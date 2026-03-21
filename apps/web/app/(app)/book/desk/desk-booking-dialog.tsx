"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Loader2,
  Clock,
  Monitor,
  Check,
  ArrowLeft,
  CalendarDays,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatDuration, formatCredits } from "@/lib/booking/format";
import {
  bookDesk,
  getAvailableDesks,
  getDeskSlotAvailability,
  type DeskTimeSlot,
} from "./actions";

interface DeskBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  minBookingMinutes: number;
  remainingCreditsMinutes: number;
  isUnlimited: boolean;
  onBooked: (result: {
    deskName: string;
    startTime: string;
    endTime: string;
  }) => void;
}

interface AvailableDesk {
  id: string;
  name: string;
  image_url: string | null;
}

type WizardStep = "time" | "desk" | "confirm";

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number) as [number, number];
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60);
  const newM = total % 60;
  return `${newH.toString().padStart(2, "0")}:${newM.toString().padStart(2, "0")}`;
}

const STEP_LABELS = ["Time", "Desk", "Confirm"] as const;
const STEP_INDEX: Record<WizardStep, number> = { time: 0, desk: 1, confirm: 2 };

export function DeskBookingDialog({
  open,
  onOpenChange,
  date,
  minBookingMinutes,
  remainingCreditsMinutes,
  isUnlimited,
  onBooked,
}: DeskBookingDialogProps) {
  const [step, setStep] = useState<WizardStep>("time");

  // Time step
  const [slots, setSlots] = useState<DeskTimeSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<number | null>(null);

  // Desk step
  const [availableDesks, setAvailableDesks] = useState<AvailableDesk[]>([]);
  const [isLoadingDesks, setIsLoadingDesks] = useState(false);
  const [selectedDeskId, setSelectedDeskId] = useState<string | null>(null);

  // General
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── Computed values ──────────────────────────────────────────────────

  const selectedRange =
    selectedStart !== null && selectedEnd !== null
      ? {
          start: Math.min(selectedStart, selectedEnd),
          end: Math.max(selectedStart, selectedEnd),
        }
      : selectedStart !== null
        ? { start: selectedStart, end: selectedStart }
        : null;

  const isRangeValid =
    selectedRange !== null &&
    slots
      .slice(selectedRange.start, selectedRange.end + 1)
      .every((s) => s.availableDesks > 0 && !s.userBooked);

  const durationMinutes = selectedRange
    ? (selectedRange.end - selectedRange.start + 1) * 30
    : 0;

  const isMinDurationMet = durationMinutes >= minBookingMinutes;
  const hasEnoughCredits =
    isUnlimited || remainingCreditsMinutes >= durationMinutes;

  const startTimeStr =
    selectedRange !== null ? (slots[selectedRange.start]?.time ?? "") : "";
  const endTimeStr =
    selectedRange !== null
      ? addMinutes(slots[selectedRange.end]?.time ?? "00:00", 30)
      : "";

  const selectedDesk = availableDesks.find((d) => d.id === selectedDeskId);
  const stepIndex = STEP_INDEX[step];

  // ── Load slot availability when dialog opens ─────────────────────────

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setIsLoadingSlots(true); // eslint-disable-line react-hooks/set-state-in-effect -- async fetch on open
    getDeskSlotAvailability(date).then((data) => {
      if (!cancelled) {
        setSlots(data);
        setIsLoadingSlots(false);
      }
    });
    return () => { cancelled = true; };
  }, [open, date]);

  // ── Handlers ─────────────────────────────────────────────────────────

  function handleSlotClick(index: number) {
    const slot = slots[index];
    if (!slot || slot.availableDesks <= 0 || slot.userBooked) return;

    if (selectedStart === null) {
      setSelectedStart(index);
      setSelectedEnd(null);
    } else if (selectedEnd === null) {
      const start = Math.min(selectedStart, index);
      const end = Math.max(selectedStart, index);
      const allAvailable = slots
        .slice(start, end + 1)
        .every((s) => s.availableDesks > 0 && !s.userBooked);

      if (allAvailable) {
        setSelectedEnd(index);
      } else {
        setSelectedStart(index);
        setSelectedEnd(null);
      }
    } else {
      setSelectedStart(index);
      setSelectedEnd(null);
    }
  }

  function goToDeskStep() {
    if (!isRangeValid || !isMinDurationMet || !hasEnoughCredits) return;
    setError(null);
    setIsLoadingDesks(true);
    setStep("desk");

    getAvailableDesks(date, startTimeStr, endTimeStr).then((desks) => {
      setAvailableDesks(desks);
      setIsLoadingDesks(false);
      if (desks.length === 0) {
        setError("No desks available for this time slot");
      }
    });
  }

  function goToConfirmStep() {
    if (!selectedDeskId) return;
    setError(null);
    setStep("confirm");
  }

  function goBack() {
    setError(null);
    if (step === "desk") {
      setStep("time");
      setSelectedDeskId(null);
      setAvailableDesks([]);
    } else if (step === "confirm") {
      setStep("desk");
    }
  }

  function handleSubmit() {
    if (!selectedDeskId || !selectedDesk) return;
    setError(null);

    startTransition(async () => {
      const result = await bookDesk(
        date,
        startTimeStr,
        endTimeStr,
        selectedDeskId,
      );

      if (result.success) {
        onBooked({
          deskName: selectedDesk.name,
          startTime: result.startTime,
          endTime: result.endTime,
        });
        resetState();
      } else {
        setError(result.error);
      }
    });
  }

  function resetState() {
    setStep("time");
    setSlots([]);
    setSelectedStart(null);
    setSelectedEnd(null);
    setAvailableDesks([]);
    setSelectedDeskId(null);
    setError(null);
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) resetState();
    onOpenChange(isOpen);
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "time" && "Select Time"}
            {step === "desk" && "Select Desk"}
            {step === "confirm" && "Confirm Booking"}
          </DialogTitle>
          <DialogDescription>
            {formatDateDisplay(date)}
            {step !== "time" &&
              startTimeStr &&
              ` \u00b7 ${startTimeStr} \u2013 ${endTimeStr}`}
            {step === "confirm" &&
              selectedDesk &&
              ` \u00b7 ${selectedDesk.name}`}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1.5">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex items-center gap-1.5">
              {i > 0 && (
                <div
                  className={`h-px w-8 ${i <= stepIndex ? "bg-primary" : "bg-border"}`}
                />
              )}
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  i < stepIndex
                    ? "bg-primary text-primary-foreground"
                    : i === stepIndex
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {i < stepIndex ? <Check className="h-3 w-3" /> : i + 1}
              </div>
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="py-1">
          {/* ── STEP 1: TIME ────────────────────────────────────────── */}
          {step === "time" && (
            <>
              {isLoadingSlots ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading availability&hellip;
                </div>
              ) : slots.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No slots available on this date
                </p>
              ) : (
                <div className="max-h-[320px] overflow-y-auto rounded-xl border border-border bg-card">
                  {slots.map((slot, i) => {
                    const isAvailable =
                      slot.availableDesks > 0 && !slot.userBooked;
                    const isSelected =
                      selectedRange !== null &&
                      i >= selectedRange.start &&
                      i <= selectedRange.end;

                    return (
                      <button
                        key={slot.time}
                        onClick={() => handleSlotClick(i)}
                        disabled={!isAvailable}
                        className={`flex w-full items-center justify-between border-b border-border px-4 py-2.5 text-sm transition-colors last:border-b-0 ${
                          !isAvailable
                            ? "cursor-not-allowed bg-muted/40 text-muted-foreground"
                            : isSelected
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-accent/50"
                        }`}
                      >
                        <span className="font-medium tabular-nums">
                          {slot.time}
                        </span>
                        <span>
                          {slot.userBooked ? (
                            <span className="text-xs text-muted-foreground">
                              Your booking
                            </span>
                          ) : slot.availableDesks <= 0 ? (
                            <span className="text-xs text-muted-foreground">
                              Full
                            </span>
                          ) : isSelected ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="h-3 w-3" />
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {slot.availableDesks} desk
                              {slot.availableDesks !== 1 ? "s" : ""}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Selection summary */}
              {selectedRange !== null && isRangeValid && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {startTimeStr} &ndash; {endTimeStr} &middot;{" "}
                    <strong>{formatDuration(durationMinutes)}</strong>
                  </span>
                  {!isUnlimited && (
                    <>
                      <span className="text-muted-foreground">&middot;</span>
                      <span>{formatCredits(durationMinutes)}</span>
                    </>
                  )}
                </div>
              )}

              {selectedRange !== null &&
                isRangeValid &&
                !isMinDurationMet && (
                  <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                    Minimum booking is {formatDuration(minBookingMinutes)}
                  </p>
                )}

              {!hasEnoughCredits && selectedRange !== null && (
                <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                  Not enough credits. You have{" "}
                  {formatCredits(remainingCreditsMinutes)} remaining.
                </p>
              )}
            </>
          )}

          {/* ── STEP 2: DESK ────────────────────────────────────────── */}
          {step === "desk" && (
            <>
              {isLoadingDesks ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading desks&hellip;
                </div>
              ) : availableDesks.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No desks available for this time slot
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {availableDesks.map((desk) => (
                    <button
                      key={desk.id}
                      type="button"
                      onClick={() => setSelectedDeskId(desk.id)}
                      className={`group relative overflow-hidden rounded-xl border text-left transition-all ${
                        selectedDeskId === desk.id
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {/* Desk image or placeholder */}
                      <div className="relative aspect-[4/3] w-full bg-muted">
                        {desk.image_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={desk.image_url}
                            alt={desk.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Monitor className="h-8 w-8 text-muted-foreground/40" />
                          </div>
                        )}
                        {selectedDeskId === desk.id && (
                          <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </div>
                      <div className="px-3 py-2">
                        <p className="text-sm font-medium">{desk.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── STEP 3: CONFIRM ─────────────────────────────────────── */}
          {step === "confirm" && selectedDesk && (
            <div className="overflow-hidden rounded-xl border border-border">
              {selectedDesk.image_url && (
                <div className="relative aspect-[16/9] w-full bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedDesk.image_url}
                    alt={selectedDesk.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              <div className="space-y-3 p-4">
                <div className="flex items-center gap-2 text-sm">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{selectedDesk.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span>{formatDateDisplay(date)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {startTimeStr} &ndash; {endTimeStr} (
                    {formatDuration(durationMinutes)})
                  </span>
                </div>
                {!isUnlimited && (
                  <div className="flex items-center gap-2 text-sm">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span>{formatCredits(durationMinutes)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          {step !== "time" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={goBack}
              disabled={isPending}
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back
            </Button>
          ) : (
            <div />
          )}

          {step === "time" && (
            <Button
              onClick={goToDeskStep}
              disabled={
                !isRangeValid || !isMinDurationMet || !hasEnoughCredits
              }
            >
              Next
            </Button>
          )}

          {step === "desk" && (
            <Button onClick={goToConfirmStep} disabled={!selectedDeskId}>
              Next
            </Button>
          )}

          {step === "confirm" && (
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm Booking
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
