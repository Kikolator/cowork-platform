"use client";

import { useState, useTransition, useMemo } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ImportResult } from "./actions";
import type { ImportEntity } from "./mappings";
import { ENTITY_MAPPINGS } from "./mappings";
import {
  importResourceSchema,
  importPlanSchema,
  importMemberSchema,
  importBookingSchema,
  importLeadSchema,
} from "./schemas";

const SCHEMAS = {
  resources: importResourceSchema,
  plans: importPlanSchema,
  members: importMemberSchema,
  bookings: importBookingSchema,
  leads: importLeadSchema,
} as const;

interface ValidatedRow {
  index: number;
  data: Record<string, string>;
  valid: boolean;
  error?: string;
}

interface StepPreviewProps {
  entity: ImportEntity;
  rows: Record<string, string>[];
  teamRows?: Record<string, string>[];
  onImport: (
    rows: Record<string, string>[],
    teamRows?: Record<string, string>[],
  ) => Promise<ImportResult>;
  onComplete: (result: ImportResult) => void;
  onBack: () => void;
}

export function StepPreview({
  entity,
  rows,
  teamRows,
  onImport,
  onComplete,
  onBack,
}: StepPreviewProps) {
  const mapping = ENTITY_MAPPINGS[entity];
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const validated: ValidatedRow[] = useMemo(() => {
    const schema = SCHEMAS[entity];
    return rows.map((row, i) => {
      const result = schema.safeParse(row);
      return {
        index: i,
        data: row,
        valid: result.success,
        error: result.success
          ? undefined
          : result.error.issues[0]?.message ?? "Invalid data",
      };
    });
  }, [rows, entity]);

  const validCount = validated.filter((r) => r.valid).length;
  const errorCount = validated.filter((r) => !r.valid).length;

  // Show column headers from the mapped data
  const columns = useMemo(() => {
    const allKeys = new Set<string>();
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        if (row[key]) allKeys.add(key);
      }
    }
    return Array.from(allKeys).slice(0, 6); // Limit columns for readability
  }, [rows]);

  function handleImport() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await onImport(rows, teamRows);
        onComplete(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">
          Preview {mapping.displayName}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the data before importing.
        </p>
      </div>

      {/* Summary bar */}
      <div className="flex gap-4 rounded-lg bg-muted/50 px-4 py-3">
        <div className="flex items-center gap-1.5 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span>{validCount} valid</span>
        </div>
        {errorCount > 0 && (
          <div className="flex items-center gap-1.5 text-sm">
            <XCircle className="h-4 w-4 text-destructive" />
            <span>{errorCount} errors</span>
          </div>
        )}
        <div className="text-sm text-muted-foreground">
          {rows.length} total rows
        </div>
      </div>

      {/* Data table */}
      <div className="max-h-80 overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead className="w-16">Status</TableHead>
              {columns.map((col) => (
                <TableHead key={col} className="max-w-40">
                  {mapping.availableFields.find((f) => f.value === col)
                    ?.label ?? col}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {validated.slice(0, 100).map((row) => (
              <TableRow
                key={row.index}
                className={!row.valid ? "bg-destructive/5" : ""}
              >
                <TableCell className="text-xs text-muted-foreground">
                  {row.index + 1}
                </TableCell>
                <TableCell>
                  {row.valid ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <span title={row.error}>
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    </span>
                  )}
                </TableCell>
                {columns.map((col) => (
                  <TableCell key={col} className="max-w-40 truncate text-sm">
                    {row.data[col] ?? ""}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {validated.length > 100 && (
        <p className="text-xs text-muted-foreground">
          Showing first 100 of {validated.length} rows.
        </p>
      )}

      {/* Error rows detail */}
      {errorCount > 0 && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <h3 className="mb-2 text-sm font-medium text-destructive">
            Rows with errors ({errorCount})
          </h3>
          <ul className="space-y-1">
            {validated
              .filter((r) => !r.valid)
              .slice(0, 10)
              .map((r) => (
                <li key={r.index} className="text-xs text-destructive">
                  Row {r.index + 1}: {r.error}
                </li>
              ))}
            {errorCount > 10 && (
              <li className="text-xs text-muted-foreground">
                ... and {errorCount - 10} more
              </li>
            )}
          </ul>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex gap-3">
        <Button onClick={handleImport} disabled={isPending || validCount === 0}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              Import {validCount}{" "}
              {validCount === 1 ? "row" : "rows"}
            </>
          )}
        </Button>
        <Button variant="outline" onClick={onBack} disabled={isPending}>
          Back
        </Button>
      </div>

      {errorCount > 0 && validCount > 0 && (
        <p className="text-xs text-muted-foreground">
          Rows with validation errors will be skipped during import.
        </p>
      )}
    </div>
  );
}
