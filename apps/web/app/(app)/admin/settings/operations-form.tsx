"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { operationsSchema, type OperationsFormValues } from "./schemas";
import { updateSpaceOperations } from "./actions";

const CURRENCIES = ["eur", "gbp", "usd", "chf"] as const;
const LOCALES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "de", label: "German" },
  { value: "fr", label: "French" },
  { value: "pt", label: "Portuguese" },
  { value: "nl", label: "Dutch" },
] as const;

const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
] as const;

const TIMEZONES = [
  "Europe/London",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Lisbon",
  "Europe/Zurich",
  "Europe/Rome",
  "Europe/Brussels",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
];

interface BusinessHours {
  [key: string]: { open: string; close: string } | null;
}

interface OperationsFormProps {
  space: {
    timezone: string;
    currency: string;
    default_locale: string;
    business_hours: unknown;
  };
}

export function OperationsForm({ space }: OperationsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const initialHours = (space.business_hours ?? {}) as BusinessHours;
  const [hours, setHours] = useState<BusinessHours>(initialHours);

  const { setValue, watch, handleSubmit } = useForm<OperationsFormValues>({
    resolver: zodResolver(operationsSchema),
    defaultValues: {
      timezone: space.timezone,
      currency: space.currency,
      defaultLocale: space.default_locale as OperationsFormValues["defaultLocale"],
      businessHours: initialHours,
    },
  });

  const watchTimezone = watch("timezone");
  const watchCurrency = watch("currency");
  const watchLocale = watch("defaultLocale");

  function updateDay(day: string, value: { open: string; close: string } | null) {
    const next = { ...hours, [day]: value };
    setHours(next);
    setValue("businessHours", next);
  }

  function onSubmit(data: OperationsFormValues) {
    setServerError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateSpaceOperations({ ...data, businessHours: hours });
      if (!result.success) {
        setServerError(result.error);
      } else {
        setSuccess(true);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {serverError && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {serverError}
        </p>
      )}
      {success && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          Operations updated.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Timezone</Label>
          <Select value={watchTimezone} onValueChange={(v) => { if (v) setValue("timezone", v); }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>{tz}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Currency</Label>
          <Select value={watchCurrency} onValueChange={(v) => { if (v) setValue("currency", v); }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>{c.toUpperCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Default locale</Label>
          <Select
            value={watchLocale}
            onValueChange={(v) => { if (v) setValue("defaultLocale", v as OperationsFormValues["defaultLocale"]); }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCALES.map((l) => (
                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">Business Hours</Label>
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-[120px_1fr_1fr_60px] items-center gap-2 border-b border-border bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>Day</span>
            <span>Open</span>
            <span>Close</span>
            <span>Closed</span>
          </div>
          {DAYS.map((day) => {
            const dayHours = hours[day.key];
            const isClosed = dayHours === null || dayHours === undefined;
            return (
              <div
                key={day.key}
                className="grid grid-cols-[120px_1fr_1fr_60px] items-center gap-2 border-b border-border px-3 py-2 last:border-0"
              >
                <span className="text-sm">{day.label}</span>
                <Input
                  type="time"
                  value={isClosed ? "" : (dayHours?.open ?? "09:00")}
                  disabled={isClosed}
                  onChange={(e) =>
                    updateDay(day.key, { open: e.target.value, close: dayHours?.close ?? "18:00" })
                  }
                  className="h-8"
                />
                <Input
                  type="time"
                  value={isClosed ? "" : (dayHours?.close ?? "18:00")}
                  disabled={isClosed}
                  onChange={(e) =>
                    updateDay(day.key, { open: dayHours?.open ?? "09:00", close: e.target.value })
                  }
                  className="h-8"
                />
                <div className="flex justify-center">
                  <Checkbox
                    checked={isClosed}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        updateDay(day.key, null);
                      } else {
                        updateDay(day.key, { open: "09:00", close: "18:00" });
                      }
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save Operations"}
        </Button>
      </div>
    </form>
  );
}
