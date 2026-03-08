"use client";

import { Infinity } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

interface ResourceType {
  id: string;
  name: string;
}

interface CreditConfigEntry {
  resourceTypeId: string;
  monthlyMinutes: number;
  isUnlimited: boolean;
}

interface PlanCreditConfigProps {
  resourceTypes: ResourceType[];
  value: CreditConfigEntry[];
  onChange: (value: CreditConfigEntry[]) => void;
}

export function PlanCreditConfig({
  resourceTypes,
  value,
  onChange,
}: PlanCreditConfigProps) {
  function getEntry(rtId: string): CreditConfigEntry {
    return (
      value.find((e) => e.resourceTypeId === rtId) ?? {
        resourceTypeId: rtId,
        monthlyMinutes: 0,
        isUnlimited: false,
      }
    );
  }

  function updateEntry(rtId: string, patch: Partial<CreditConfigEntry>) {
    const existing = getEntry(rtId);
    const updated = { ...existing, ...patch, resourceTypeId: rtId };
    const next = value.filter((e) => e.resourceTypeId !== rtId);
    next.push(updated);
    onChange(next);
  }

  if (resourceTypes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No resource types configured. Add resource types in the Resources page
        first.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {resourceTypes.map((rt) => {
        const entry = getEntry(rt.id);
        return (
          <div
            key={rt.id}
            className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {rt.name}
            </span>

            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step={1}
                value={entry.isUnlimited ? "" : Math.round(entry.monthlyMinutes / 60)}
                disabled={entry.isUnlimited}
                onChange={(e) => {
                  const hours = parseInt(e.target.value, 10);
                  updateEntry(rt.id, {
                    monthlyMinutes: isNaN(hours) ? 0 : hours * 60,
                  });
                }}
                className="h-7 w-20 text-center tabular-nums"
                placeholder="0"
              />
              <span className="text-xs text-muted-foreground">hrs</span>
            </div>

            <label className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted">
              <Checkbox
                checked={entry.isUnlimited}
                onCheckedChange={(checked) => {
                  updateEntry(rt.id, { isUnlimited: checked === true });
                }}
              />
              <Infinity className="h-3.5 w-3.5" />
            </label>
          </div>
        );
      })}
      <p className="pt-1 text-[11px] text-muted-foreground">
        Leave at 0 to exclude a resource type from this plan. Toggle
        &infin; for unlimited.
      </p>
    </div>
  );
}
