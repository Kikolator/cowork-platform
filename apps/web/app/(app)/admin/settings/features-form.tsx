"use client";

import { useState, useTransition } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateFeatureFlag } from "./actions";

const FEATURE_FLAGS = [
  { key: "passes", label: "Passes", description: "Allow day and week passes" },
  { key: "credits", label: "Credits", description: "Enable credit-based booking system" },
  { key: "leads", label: "Leads", description: "Enable lead pipeline and trial days" },
  { key: "recurring_bookings", label: "Recurring Bookings", description: "Allow members to set up recurring bookings" },
  { key: "guest_passes", label: "Guest Passes", description: "Allow members to purchase passes for guests" },
  { key: "open_registration", label: "Open Registration", description: "Allow anyone to create an account (vs invite-only)" },
  { key: "referrals", label: "Referrals", description: "Allow members to refer new members and earn rewards" },
] as const;

interface FeaturesFormProps {
  features: Record<string, boolean>;
}

export function FeaturesForm({ features: initialFeatures }: FeaturesFormProps) {
  const [isPending, startTransition] = useTransition();
  const [features, setFeatures] = useState(initialFeatures);
  const [lastError, setLastError] = useState<string | null>(null);

  function handleToggle(key: string, value: boolean) {
    setLastError(null);
    setFeatures((prev) => ({ ...prev, [key]: value }));
    startTransition(async () => {
      const result = await updateFeatureFlag(key, value);
      if (!result.success) {
        setLastError(result.error);
        // Revert on error
        setFeatures((prev) => ({ ...prev, [key]: !value }));
      }
    });
  }

  return (
    <div className="space-y-4">
      {lastError && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {lastError}
        </p>
      )}
      {FEATURE_FLAGS.map((flag) => (
        <div
          key={flag.key}
          className="flex items-center justify-between rounded-xl border border-border p-4"
        >
          <div>
            <Label className="text-sm font-medium">{flag.label}</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">{flag.description}</p>
          </div>
          <Switch
            checked={features[flag.key] ?? false}
            onCheckedChange={(checked) => handleToggle(flag.key, checked)}
            disabled={isPending}
          />
        </div>
      ))}
    </div>
  );
}
