"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CsvDropzone } from "./csv-dropzone";
import { ColumnMapper } from "./column-mapper";
import { parseCSV } from "@/lib/csv";
import {
  autoDetectMappings,
  applyMappings,
  ENTITY_MAPPINGS,
  type ImportEntity,
} from "./mappings";

interface StepUploadProps {
  entity: ImportEntity;
  onDataReady: (mappedRows: Record<string, string>[]) => void;
  onSkip: () => void;
}

export function StepUpload({ entity, onDataReady, onSkip }: StepUploadProps) {
  const mapping = ENTITY_MAPPINGS[entity];
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileLoaded = useCallback(
    (text: string, name: string) => {
      const { headers: h, rows } = parseCSV(text);
      setHeaders(h);
      setRawRows(rows);
      setFileName(name);
      setColumnMap(autoDetectMappings(h, entity));
    },
    [entity],
  );

  const usedFields = new Set(Object.values(columnMap));
  const missingRequired = mapping.required.filter((f) => !usedFields.has(f));
  const canProceed = rawRows.length > 0 && missingRequired.length === 0;

  function handleContinue() {
    const mapped = applyMappings(rawRows, columnMap);
    onDataReady(mapped);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">
          Import {mapping.displayName}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a CSV file exported from OfficeRnd containing your{" "}
          {mapping.displayName.toLowerCase()} data.
        </p>
      </div>

      {!fileName ? (
        <CsvDropzone onFileLoaded={handleFileLoaded} />
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
            <div>
              <p className="text-sm font-medium">{fileName}</p>
              <p className="text-xs text-muted-foreground">
                {rawRows.length} rows, {headers.length} columns
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setHeaders([]);
                setRawRows([]);
                setFileName(null);
                setColumnMap({});
              }}
            >
              Change file
            </Button>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-medium">Column Mapping</h3>
            <ColumnMapper
              csvHeaders={headers}
              columnMap={columnMap}
              onChange={setColumnMap}
              mapping={mapping}
            />
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button onClick={handleContinue} disabled={!canProceed}>
          Preview {rawRows.length > 0 ? `${rawRows.length} rows` : ""}
        </Button>
        <Button variant="outline" onClick={onSkip}>
          Skip
        </Button>
      </div>
    </div>
  );
}
