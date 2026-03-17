"use client";

import { CheckCircle2, XCircle, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ENTITY_MAPPINGS, IMPORT_ENTITIES, type ImportEntity } from "./mappings";
import type { ImportResult } from "./actions";

interface StepSummaryProps {
  results: Partial<Record<ImportEntity, ImportResult>>;
  onDone: () => void;
}

export function StepSummary({ results, onDone }: StepSummaryProps) {
  const totalInserted = Object.values(results).reduce(
    (sum, r) => sum + (r?.inserted ?? 0),
    0,
  );
  const totalErrors = Object.values(results).reduce(
    (sum, r) => sum + (r?.errors.length ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Import Complete</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {totalInserted} records imported
          {totalErrors > 0 ? `, ${totalErrors} errors` : ""}.
        </p>
      </div>

      {/* Summary cards */}
      <div className="space-y-3">
        {IMPORT_ENTITIES.map((entity) => {
          const result = results[entity];
          const mapping = ENTITY_MAPPINGS[entity];

          if (!result) {
            return (
              <div
                key={entity}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <SkipForward className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{mapping.displayName}</span>
                </div>
                <Badge variant="secondary">Skipped</Badge>
              </div>
            );
          }

          const hasErrors = result.errors.length > 0;

          return (
            <div
              key={entity}
              className="rounded-lg border px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {hasErrors ? (
                    <XCircle className="h-4 w-4 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                  <span className="text-sm font-medium">
                    {mapping.displayName}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Badge variant="default">
                    {result.inserted} imported
                  </Badge>
                  {result.skipped > 0 && (
                    <Badge variant="secondary">
                      {result.skipped} skipped
                    </Badge>
                  )}
                  {hasErrors && (
                    <Badge variant="destructive">
                      {result.errors.length} errors
                    </Badge>
                  )}
                </div>
              </div>

              {hasErrors && (
                <ul className="mt-2 space-y-0.5 border-t pt-2">
                  {result.errors.slice(0, 5).map((err, i) => (
                    <li
                      key={i}
                      className="text-xs text-muted-foreground"
                    >
                      Row {err.row}: {err.message}
                    </li>
                  ))}
                  {result.errors.length > 5 && (
                    <li className="text-xs text-muted-foreground">
                      ... and {result.errors.length - 5} more
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-lg bg-muted/50 p-4">
        <p className="text-sm">
          <strong>Next steps:</strong> Your imported members don&apos;t have
          accounts yet. Go to the Members page to review them and send magic
          link invites when your space is ready.
        </p>
      </div>

      <Button onClick={onDone} size="lg">
        Go to Dashboard
      </Button>
    </div>
  );
}
