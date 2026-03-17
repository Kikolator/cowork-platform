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
  TEAMS_MAPPING,
  type ImportEntity,
} from "./mappings";

interface StepUploadProps {
  entity: ImportEntity;
  onDataReady: (
    mappedRows: Record<string, string>[],
    teamRows?: Record<string, string>[],
  ) => void;
  onSkip: () => void;
}

export function StepUpload({ entity, onDataReady, onSkip }: StepUploadProps) {
  const mapping = ENTITY_MAPPINGS[entity];
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState<string | null>(null);

  // Teams CSV state (optional, only for members entity)
  const [teamsHeaders, setTeamsHeaders] = useState<string[]>([]);
  const [teamsRawRows, setTeamsRawRows] = useState<Record<string, string>[]>(
    [],
  );
  const [teamsColumnMap, setTeamsColumnMap] = useState<Record<string, string>>(
    {},
  );
  const [teamsFileName, setTeamsFileName] = useState<string | null>(null);

  const showTeamsUpload = entity === "members";

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

  const handleTeamsFileLoaded = useCallback((text: string, name: string) => {
    const { headers: h, rows } = parseCSV(text);
    setTeamsHeaders(h);
    setTeamsRawRows(rows);
    setTeamsFileName(name);
    setTeamsColumnMap(autoDetectMappings(h, "teams"));
  }, []);

  const usedFields = new Set(Object.values(columnMap));
  const missingRequired = mapping.required.filter((f) => !usedFields.has(f));
  const canProceed = rawRows.length > 0 && missingRequired.length === 0;

  function handleContinue() {
    const mapped = applyMappings(rawRows, columnMap);
    const teamsMapped =
      teamsRawRows.length > 0
        ? applyMappings(teamsRawRows, teamsColumnMap)
        : undefined;
    onDataReady(mapped, teamsMapped);
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

      {showTeamsUpload && fileName && (
        <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
          <div>
            <h3 className="text-sm font-medium">
              Teams CSV{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload the teams/companies CSV to merge billing data (VAT,
              address) with matching members.
            </p>
          </div>

          {!teamsFileName ? (
            <CsvDropzone onFileLoaded={handleTeamsFileLoaded} />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{teamsFileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {teamsRawRows.length} teams, {teamsHeaders.length} columns
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTeamsHeaders([]);
                    setTeamsRawRows([]);
                    setTeamsFileName(null);
                    setTeamsColumnMap({});
                  }}
                >
                  Remove
                </Button>
              </div>

              <div>
                <h4 className="mb-2 text-xs font-medium text-muted-foreground">
                  Teams Column Mapping
                </h4>
                <ColumnMapper
                  csvHeaders={teamsHeaders}
                  columnMap={teamsColumnMap}
                  onChange={setTeamsColumnMap}
                  mapping={TEAMS_MAPPING}
                />
              </div>
            </div>
          )}
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
