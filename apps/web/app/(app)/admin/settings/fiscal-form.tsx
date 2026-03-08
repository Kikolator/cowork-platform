"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { updateSpaceFiscal } from "./actions";

const FISCAL_ID_TYPES = [
  { value: "nif", label: "NIF (Spain)" },
  { value: "nie", label: "NIE (Spain)" },
  { value: "cif", label: "CIF (Spain)" },
  { value: "passport", label: "Passport" },
  { value: "eu_vat", label: "EU VAT" },
  { value: "foreign_tax_id", label: "Foreign Tax ID" },
  { value: "other", label: "Other" },
] as const;

interface FiscalFormProps {
  space: {
    require_fiscal_id: boolean | null;
    supported_fiscal_id_types: unknown;
  };
}

export function FiscalForm({ space }: FiscalFormProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [requireFiscalId, setRequireFiscalId] = useState(space.require_fiscal_id ?? false);

  const initialTypes = Array.isArray(space.supported_fiscal_id_types)
    ? (space.supported_fiscal_id_types as string[])
    : ["nif", "nie", "passport", "cif"];
  const [selectedTypes, setSelectedTypes] = useState<string[]>(initialTypes);

  function toggleType(type: string) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateSpaceFiscal({
        requireFiscalId,
        supportedFiscalIdTypes: selectedTypes,
      });
      if (!result.success) {
        setServerError(result.error);
      } else {
        setSuccess(true);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {serverError && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {serverError}
        </p>
      )}
      {success && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          Fiscal settings updated.
        </p>
      )}

      <div className="flex items-center justify-between rounded-xl border border-border p-4">
        <div>
          <Label className="text-sm font-medium">Require fiscal ID for checkout</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            When enabled, members must provide a fiscal ID before completing any purchase.
            Required by law in Spain and some EU countries.
          </p>
        </div>
        <Switch
          checked={requireFiscalId}
          onCheckedChange={setRequireFiscalId}
        />
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">Supported ID types</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {FISCAL_ID_TYPES.map((type) => (
            <label
              key={type.value}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 transition-colors hover:bg-muted/50"
            >
              <Checkbox
                checked={selectedTypes.includes(type.value)}
                onCheckedChange={() => toggleType(type.value)}
              />
              <span className="text-sm">{type.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save Fiscal Settings"}
        </Button>
      </div>
    </form>
  );
}
