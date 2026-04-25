"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Trash2Icon } from "lucide-react";
import { addClosure, removeClosure } from "./actions";

interface Closure {
  id: string;
  date: string;
  reason: string | null;
}

interface ClosuresFormProps {
  closures: Closure[];
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ClosuresForm({ closures: initial }: ClosuresFormProps) {
  const [closures, setClosures] = useState(initial);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const closureDateSet = new Set(closures.map((c) => c.date));

  function handleAdd() {
    if (!selectedDate) return;
    setError(null);

    const dateStr = selectedDate.toISOString().split("T")[0]!;
    if (closureDateSet.has(dateStr)) {
      setError("This date is already marked as closed");
      return;
    }

    startTransition(async () => {
      const result = await addClosure(dateStr, reason.trim() || null);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setClosures((prev) =>
        [...prev, { id: result.id, date: dateStr, reason: reason.trim() || null }]
          .sort((a, b) => a.date.localeCompare(b.date)),
      );
      setSelectedDate(undefined);
      setReason("");
    });
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      const result = await removeClosure(id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setClosures((prev) => prev.filter((c) => c.id !== id));
    });
  }

  // Split into upcoming and past
  const today = new Date().toISOString().split("T")[0]!;
  const upcoming = closures.filter((c) => c.date >= today);
  const past = closures.filter((c) => c.date < today);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Closure Days</h3>
        <p className="text-sm text-muted-foreground">
          Mark specific dates when the space is closed (holidays, maintenance, etc.).
          These dates will be blocked in the booking and checkout calendars.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Add closure */}
      <div className="rounded-xl border border-border p-4 space-y-4">
        <Label className="text-sm font-medium">Add Closure</Label>
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            disabled={[
              { before: new Date() },
              ...Array.from(closureDateSet).map((d) => new Date(d + "T12:00:00Z")),
            ]}
            className="rounded-lg border border-border"
          />
          <div className="flex w-full flex-col gap-3 sm:w-64">
            <div className="space-y-1.5">
              <Label htmlFor="closure-reason">Reason (optional)</Label>
              <Input
                id="closure-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Christmas Day"
              />
            </div>
            {selectedDate && (
              <p className="text-sm text-muted-foreground">
                Selected: {formatDate(selectedDate.toISOString().split("T")[0]!)}
              </p>
            )}
            <Button
              onClick={handleAdd}
              disabled={!selectedDate || isPending}
              className="w-full"
            >
              {isPending ? "Adding..." : "Add Closure"}
            </Button>
          </div>
        </div>
      </div>

      {/* Upcoming closures list */}
      {upcoming.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">
            Upcoming Closures ({upcoming.length})
          </Label>
          <div className="overflow-hidden rounded-xl border border-border">
            {upcoming.map((closure, i) => (
              <div
                key={closure.id}
                className={`flex items-center justify-between px-4 py-3 ${
                  i < upcoming.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div>
                  <p className="text-sm font-medium">{formatDate(closure.date)}</p>
                  {closure.reason && (
                    <p className="text-xs text-muted-foreground">{closure.reason}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(closure.id)}
                  disabled={isPending}
                >
                  <Trash2Icon className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {upcoming.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No upcoming closures. Add dates above to block bookings and pass purchases.
        </p>
      )}

      {/* Past closures (collapsed) */}
      {past.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Past closures ({past.length})
          </summary>
          <div className="mt-2 overflow-hidden rounded-xl border border-border">
            {past.map((closure, i) => (
              <div
                key={closure.id}
                className={`flex items-center justify-between px-4 py-3 opacity-60 ${
                  i < past.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div>
                  <p className="text-sm">{formatDate(closure.date)}</p>
                  {closure.reason && (
                    <p className="text-xs text-muted-foreground">{closure.reason}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(closure.id)}
                  disabled={isPending}
                >
                  <Trash2Icon className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
