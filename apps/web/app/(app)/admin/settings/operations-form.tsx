"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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

const MIN_BOOKING_OPTIONS = [
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
] as const;

interface OperationsFormProps {
  space: {
    timezone: string;
    currency: string;
    default_locale: string;
    business_hours: unknown;
    min_booking_minutes: number;
    max_pass_desks: number | null;
    wifi_network: string | null;
    wifi_password: string | null;
    community_rules_text: string | null;
  };
}

export function OperationsForm({ space }: OperationsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const initialHours = (space.business_hours ?? {}) as BusinessHours;
  const [hours, setHours] = useState<BusinessHours>(initialHours);

  const { register, setValue, watch, handleSubmit } = useForm<OperationsFormValues>({
    resolver: zodResolver(operationsSchema),
    defaultValues: {
      timezone: space.timezone,
      currency: space.currency,
      defaultLocale: space.default_locale as OperationsFormValues["defaultLocale"],
      businessHours: initialHours,
      minBookingMinutes: space.min_booking_minutes,
      maxPassDesks: space.max_pass_desks ?? "",
      wifiNetwork: space.wifi_network ?? "",
      wifiPassword: space.wifi_password ?? "",
      communityRulesText: space.community_rules_text ?? "",
    },
  });

  const watchTimezone = watch("timezone");
  const watchCurrency = watch("currency");
  const watchLocale = watch("defaultLocale");
  const watchMinBooking = watch("minBookingMinutes");

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
          <Select value={watchTimezone} onValueChange={(v) => { if (v) setValue("timezone", v); }} items={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}>
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
          <Select value={watchCurrency} onValueChange={(v) => { if (v) setValue("currency", v); }} items={CURRENCIES.map((c) => ({ value: c, label: c.toUpperCase() }))}>
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
            items={LOCALES.map((l) => ({ value: l.value, label: l.label }))}
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

      <div className="space-y-1.5">
        <Label>Minimum booking time</Label>
        <Select
          value={String(watchMinBooking)}
          onValueChange={(v) => { if (v) setValue("minBookingMinutes", parseInt(v, 10)); }}
          items={MIN_BOOKING_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MIN_BOOKING_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          Shortest duration a member can book.
        </p>
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

      <Separator />

      {/* ── Pass & Guest Settings ── */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Pass & Guest Settings</Label>
        <div className="space-y-1.5">
          <Label htmlFor="maxPassDesks">Max desks for pass holders</Label>
          <Input
            id="maxPassDesks"
            type="number"
            min={1}
            className="w-48"
            defaultValue={space.max_pass_desks ?? ""}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setValue("maxPassDesks", isNaN(val) ? "" : val);
            }}
            placeholder="No limit"
          />
          <p className="text-[11px] text-muted-foreground">
            Maximum desks allocatable to pass holders at any time. Leave empty for no limit.
          </p>
        </div>
      </div>

      <Separator />

      {/* ── WiFi ── */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">WiFi</Label>
        <p className="text-[11px] text-muted-foreground">
          Shown to pass holders and members in confirmation emails.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="wifiNetwork">Network name</Label>
            <Input
              id="wifiNetwork"
              {...register("wifiNetwork")}
              placeholder="MySpace-WiFi"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wifiPassword">Password</Label>
            <Input
              id="wifiPassword"
              {...register("wifiPassword")}
              placeholder="wifi-password"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* ── Community Rules ── */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Community Rules</Label>
        <p className="text-[11px] text-muted-foreground">
          Shown during checkout. Visitors must accept before purchasing. Supports markdown.
        </p>
        <Textarea
          {...register("communityRulesText")}
          placeholder={"# House Rules\n\n- Be respectful of others\n- Keep noise levels down\n- Clean up after yourself"}
          rows={8}
          className="font-mono text-sm"
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save Operations"}
        </Button>
      </div>
    </form>
  );
}
