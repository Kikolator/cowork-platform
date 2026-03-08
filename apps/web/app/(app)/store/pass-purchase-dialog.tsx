"use client";

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { purchasePass, getDateAvailability } from "./actions";

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
  onError: (msg: string) => void;
}

function formatPrice(cents: number, currency: string): string {
  const amount = cents / 100;
  const symbol =
    currency.toLowerCase() === "eur" ? "\u20AC" : currency.toUpperCase() + " ";
  return `${symbol}${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

function getTodayString(): string {
  return new Date().toISOString().split("T")[0]!;
}

export function PassPurchaseDialog({
  open,
  onOpenChange,
  product,
  guestPassesEnabled,
  onError,
}: PassPurchaseDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedDate, setSelectedDate] = useState(getTodayString());
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

  // Check availability when date changes
  useEffect(() => {
    if (!open || !selectedDate) return;

    let cancelled = false;
    setCheckingAvailability(true);

    getDateAvailability(selectedDate).then((result) => {
      if (!cancelled) {
        setAvailability(result);
        setCheckingAvailability(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedDate, open]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedDate(getTodayString());
      setIsGuest(false);
      setGuestName("");
      setGuestEmail("");
      setError(null);
      setAvailability(null);
    }
  }, [open]);

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
    if (isGuest && !guestName.trim()) {
      setError("Guest name is required");
      return;
    }
    if (isGuest && !guestEmail.trim()) {
      setError("Guest email is required");
      return;
    }

    startTransition(async () => {
      const result = await purchasePass(
        product.id,
        selectedDate,
        isGuest,
        isGuest ? guestName.trim() : undefined,
        isGuest ? guestEmail.trim() : undefined,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {product.name} — {formatPrice(product.price_cents, product.currency)}
          </DialogTitle>
          <DialogDescription>
            Select a start date for your pass.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="pass-date">Start Date</Label>
            <Input
              id="pass-date"
              type="date"
              value={selectedDate}
              min={getTodayString()}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          {checkingAvailability && (
            <p className="text-sm text-zinc-500">Checking availability...</p>
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isPending ||
                !availability?.available ||
                checkingAvailability
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
