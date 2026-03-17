"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EntityMapping } from "./mappings";

interface ColumnMapperProps {
  csvHeaders: string[];
  columnMap: Record<string, string>;
  onChange: (map: Record<string, string>) => void;
  mapping: EntityMapping;
}

const SKIP_VALUE = "__skip__";

export function ColumnMapper({
  csvHeaders,
  columnMap,
  onChange,
  mapping,
}: ColumnMapperProps) {
  const usedFields = new Set(Object.values(columnMap).filter((v) => v !== SKIP_VALUE));
  const missingRequired = mapping.required.filter(
    (f) => !usedFields.has(f),
  );

  function handleChange(header: string, value: string) {
    const next = { ...columnMap };
    if (value === SKIP_VALUE) {
      delete next[header];
    } else {
      next[header] = value;
    }
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-3 text-xs font-medium text-muted-foreground">
        <span>CSV Column</span>
        <span />
        <span>Maps to</span>
      </div>

      {csvHeaders.map((header, index) => {
        const currentValue = columnMap[header] ?? SKIP_VALUE;
        return (
          <div
            key={`${index}-${header}`}
            className="grid grid-cols-[1fr,auto,1fr] items-center gap-3"
          >
            <span className="truncate rounded bg-muted px-2 py-1.5 text-sm font-mono">
              {header}
            </span>
            <span className="text-muted-foreground">&rarr;</span>
            <Select
              value={currentValue}
              onValueChange={(v) => handleChange(header, v ?? SKIP_VALUE)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Skip" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SKIP_VALUE}>
                  <span className="text-muted-foreground">Skip</span>
                </SelectItem>
                {mapping.availableFields.map((field) => (
                  <SelectItem
                    key={field.value}
                    value={field.value}
                    disabled={
                      usedFields.has(field.value) &&
                      currentValue !== field.value
                    }
                  >
                    {field.label}
                    {mapping.required.includes(field.value) && (
                      <span className="ml-1 text-destructive">*</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}

      {missingRequired.length > 0 && (
        <p className="text-xs text-destructive">
          Required fields not mapped:{" "}
          {missingRequired
            .map(
              (f) =>
                mapping.availableFields.find((af) => af.value === f)?.label ??
                f,
            )
            .join(", ")}
        </p>
      )}
    </div>
  );
}
