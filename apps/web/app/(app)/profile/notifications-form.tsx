"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NotificationsValues } from "./schemas";
import { updateNotificationPreferences } from "./actions";

const CHANNELS = [
  { value: "email", label: "Email" },
  { value: "push", label: "Push" },
  { value: "sms", label: "SMS" },
] as const;

interface NotificationsFormProps {
  preferences: {
    booking_reminders: boolean | null;
    credit_warnings: boolean | null;
    marketing: boolean | null;
    weekly_summary: boolean | null;
    preferred_channel: string | null;
  } | null;
}

export function NotificationsForm({ preferences }: NotificationsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [bookingReminders, setBookingReminders] = useState(preferences?.booking_reminders ?? true);
  const [creditWarnings, setCreditWarnings] = useState(preferences?.credit_warnings ?? true);
  const [marketing, setMarketing] = useState(preferences?.marketing ?? false);
  const [weeklySummary, setWeeklySummary] = useState(preferences?.weekly_summary ?? true);
  const [preferredChannel, setPreferredChannel] = useState<NotificationsValues["preferredChannel"]>(
    (preferences?.preferred_channel as NotificationsValues["preferredChannel"]) ?? "email",
  );

  function onSubmit() {
    setServerError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateNotificationPreferences({
        bookingReminders,
        creditWarnings,
        marketing,
        weeklySummary,
        preferredChannel,
      });
      if (!result.success) {
        setServerError(result.error);
      } else {
        setSuccess(true);
      }
    });
  }

  return (
    <div className="space-y-5">
      {serverError && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {serverError}
        </p>
      )}
      {success && !serverError && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          Preferences saved.
        </p>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="notif-booking">Booking reminders</Label>
            <p className="text-xs text-muted-foreground">Get reminders before your bookings.</p>
          </div>
          <Switch
            id="notif-booking"
            checked={bookingReminders}
            onCheckedChange={setBookingReminders}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="notif-credits">Credit warnings</Label>
            <p className="text-xs text-muted-foreground">Alerts when your credits are running low.</p>
          </div>
          <Switch
            id="notif-credits"
            checked={creditWarnings}
            onCheckedChange={setCreditWarnings}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="notif-marketing">Marketing</Label>
            <p className="text-xs text-muted-foreground">News, events, and promotions.</p>
          </div>
          <Switch
            id="notif-marketing"
            checked={marketing}
            onCheckedChange={setMarketing}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="notif-weekly">Weekly summary</Label>
            <p className="text-xs text-muted-foreground">A weekly digest of your activity.</p>
          </div>
          <Switch
            id="notif-weekly"
            checked={weeklySummary}
            onCheckedChange={setWeeklySummary}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Preferred channel</Label>
        <Select
          value={preferredChannel}
          onValueChange={(v) => {
            if (v) setPreferredChannel(v as NotificationsValues["preferredChannel"]);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue>
              {CHANNELS.find((c) => c.value === preferredChannel)?.label ?? "Email"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {CHANNELS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end">
        <Button onClick={onSubmit} disabled={isPending}>
          {isPending ? "Saving..." : "Save Preferences"}
        </Button>
      </div>
    </div>
  );
}
