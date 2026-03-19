"use client";

import { useState, useTransition } from "react";
import { updatePlatformFee } from "./actions";

const PLAN_FEE_DEFAULTS: Record<string, number> = {
  free: 5,
  pro: 3,
  enterprise: 1,
};

interface PlatformFeeEditorProps {
  tenantId: string;
  platformPlan: string;
  currentOverride: number | null;
}

export function PlatformFeeEditor({
  tenantId,
  platformPlan,
  currentOverride,
}: PlatformFeeEditorProps) {
  const planDefault = PLAN_FEE_DEFAULTS[platformPlan] ?? 5;
  const effectiveFee = currentOverride ?? planDefault;

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(effectiveFee));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave(overrideValue: number | null) {
    setError(null);
    startTransition(async () => {
      const result = await updatePlatformFee(tenantId, overrideValue);
      if (result.error) {
        setError(result.error);
      } else {
        setEditing(false);
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Platform Fee</dt>
        <dd className="flex items-center gap-2">
          <span className="font-medium">{effectiveFee}%</span>
          {currentOverride !== null && (
            <span className="text-xs text-muted-foreground">(override)</span>
          )}
          <button
            onClick={() => {
              setValue(String(effectiveFee));
              setEditing(true);
            }}
            className="text-xs text-chart-1 hover:underline"
          >
            Edit
          </button>
        </dd>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Platform Fee</span>
        <span className="text-xs text-muted-foreground">
          Plan default: {planDefault}%
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={50}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isPending}
          className="h-8 w-20 rounded-md border border-border bg-background px-2 text-sm font-mono"
        />
        <span className="text-sm text-muted-foreground">%</span>
        <button
          onClick={() => {
            const num = parseInt(value, 10);
            if (isNaN(num) || num < 0 || num > 50) {
              setError("Must be 0–50");
              return;
            }
            handleSave(num === planDefault ? null : num);
          }}
          disabled={isPending}
          className="h-8 rounded-md bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
        {currentOverride !== null && (
          <button
            onClick={() => handleSave(null)}
            disabled={isPending}
            className="h-8 rounded-md border border-border px-3 text-xs text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            Reset
          </button>
        )}
        <button
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          className="text-xs text-muted-foreground hover:underline"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
