"use client";

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import ReactMarkdown from "react-markdown";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { purchasePass, getDateAvailability, getClosedDates } from "./actions";

interface PassPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    id: string;
    name: string;
    price_cents: number;
    currency: string;
    slug: string;
  } | null;
  guestPassesEnabled: boolean;
  communityRulesText: string | null;
  onError: (msg: string) => void;
}

function formatPrice(cents: number, currency: string): string {
  const amount = cents / 100;
  const symbol =
    currency.toLowerCase() === "eur" ? "\u20AC" : currency.toUpperCase() + " ";
  return `${symbol}${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

export function PassPurchaseDialog({
  open,
  onOpenChange,
  product,
  guestPassesEnabled,
  communityRulesText,
  onError,
}: PassPurchaseDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isGuest, setIsGuest] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [availability, setAvailability] = useState<{
    available: boolean;
    reason?: string;
    desks: number;
  } | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const hasRules = !!communityRulesText?.trim();

  // Closed dates for calendar disabling
  const [closureDates, setClosureDates] = useState<Date[]>([]);
  const [closedWeekdays, setClosedWeekdays] = useState<number[]>([]);

  // Fetch closed dates on dialog open
  useEffect(() => {
    if (!open) return;
    getClosedDates().then(({ closureDates: dates, closedWeekdays: days }) => {
      setClosureDates(dates.map((d) => new Date(d + "T12:00:00Z")));
      setClosedWeekdays(days);
    });
  }, [open]);

  // Check availability when date changes
  const selectedDateStr = selectedDate?.toISOString().split("T")[0] ?? null;
  useEffect(() => {
    if (!open || !selectedDateStr) return;

    let cancelled = false;

    getDateAvailability(selectedDateStr).then((result) => {
      if (!cancelled) {
        setAvailability(result);
        setCheckingAvailability(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedDateStr, open]);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setSelectedDate(undefined);
      setIsGuest(false);
      setGuestName("");
      setGuestEmail("");
      setError(null);
      setAvailability(null);
      setCheckingAvailability(false);
      setRulesAccepted(false);
      setRulesExpanded(false);
    }
    onOpenChange(nextOpen);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!product) return;
    if (!selectedDate) {
      setError("Please select a date");
      return;
    }
    if (availability && !availability.available) {
      setError("No desks available on this date");
      return;
    }
    if (hasRules && !rulesAccepted) {
      setError("Please accept the community rules");
      return;
    }
    if (isGuest && !guestName.trim()) {
      setError("Guest name is required");
      return;
    }
    if (isGuest && !guestEmail.trim()) {
      setError("Guest email is required");
      return;
    }

    const dateStr = selectedDate.toISOString().split("T")[0]!;

    startTransition(async () => {
      const result = await purchasePass(
        product.id,
        dateStr,
        isGuest,
        isGuest ? guestName.trim() : undefined,
        isGuest ? guestEmail.trim() : undefined,
        rulesAccepted,
      );

      if (!result.success) {
        onError(result.error);
        onOpenChange(false);
        return;
      }

      window.location.href = result.url;
    });
  }

  if (!product) return null;

  // Build disabled dates matcher for calendar
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const disabledMatcher = [
    { before: today },
    ...closureDates,
    ...(closedWeekdays.length > 0
      ? [{ dayOfWeek: closedWeekdays }]
      : []),
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {product.name} — {formatPrice(product.price_cents, product.currency)}
          </DialogTitle>
          <DialogDescription>
            Select a start date for your pass. Greyed out dates are unavailable.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                setSelectedDate(date);
                setAvailability(null);
                setCheckingAvailability(!!date);
              }}
              disabled={disabledMatcher}
              className="rounded-lg border border-border"
            />
          </div>

          {checkingAvailability && (
            <p className="text-center text-sm text-zinc-500">Checking availability...</p>
          )}

          {availability && !checkingAvailability && (
            <div
              className={`rounded-lg px-4 py-3 text-sm ${
                availability.available
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
              }`}
            >
              {availability.reason === "closed"
                ? "The space is closed on this date"
                : availability.available
                  ? `${availability.desks} desk${availability.desks === 1 ? "" : "s"} available`
                  : "No desks available on this date"}
            </div>
          )}

          {guestPassesEnabled && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={isGuest}
                  onCheckedChange={(checked) => setIsGuest(!!checked)}
                  id="guest-pass"
                />
                <Label htmlFor="guest-pass" className="cursor-pointer">
                  This is a guest pass
                </Label>
              </div>

              {isGuest && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="guest-name">Guest Name</Label>
                    <Input
                      id="guest-name"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Guest's full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guest-email">Guest Email</Label>
                    <Input
                      id="guest-email"
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="Guest's email"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {hasRules && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setRulesExpanded(!rulesExpanded)}
                className="text-sm font-medium text-foreground underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground"
              >
                {rulesExpanded ? "Hide" : "View"} community rules
              </button>
              {rulesExpanded && (
                <div className="prose prose-sm dark:prose-invert max-h-48 max-w-none overflow-y-auto rounded-lg border border-border bg-muted/30 p-3">
                  <ReactMarkdown>{communityRulesText!}</ReactMarkdown>
                </div>
              )}
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={rulesAccepted}
                  onCheckedChange={(checked) => setRulesAccepted(checked === true)}
                />
                <span className="text-sm">
                  I accept the community rules and workspace etiquette
                </span>
              </label>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isPending ||
                !selectedDate ||
                !availability?.available ||
                checkingAvailability ||
                (hasRules && !rulesAccepted)
              }
            >
              {isPending ? "Processing..." : "Proceed to Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
