"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProgressBar } from "./progress-bar";
import { StepWelcome } from "./step-welcome";
import { StepUpload } from "./step-upload";
import { StepPreview } from "./step-preview";
import { StepSummary } from "./step-summary";
import {
  importResources,
  importPlans,
  importMembers,
  importBookings,
  importLeads,
  completeImportJob,
  type ImportResult,
} from "./actions";
import { IMPORT_ENTITIES, type ImportEntity } from "./mappings";

const ENTITY_ACTIONS: Record<
  ImportEntity,
  (
    rows: Record<string, string>[],
    teamRows?: Record<string, string>[],
  ) => Promise<ImportResult>
> = {
  resources: importResources,
  plans: importPlans,
  members: importMembers,
  bookings: importBookings,
  leads: importLeads,
};

type WizardStep =
  | { type: "welcome" }
  | { type: "upload"; entity: ImportEntity }
  | {
      type: "preview";
      entity: ImportEntity;
      rows: Record<string, string>[];
      teamRows?: Record<string, string>[];
    }
  | { type: "summary" };

export function ImportWizard() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>({ type: "welcome" });
  const [jobId, setJobId] = useState<string | null>(null);
  const [results, setResults] = useState<
    Partial<Record<ImportEntity, ImportResult>>
  >({});

  const currentStepId =
    step.type === "welcome"
      ? "welcome"
      : step.type === "summary"
        ? "summary"
        : step.type === "upload" || step.type === "preview"
          ? step.entity
          : "welcome";

  function handleStart(id: string) {
    setJobId(id);
    setStep({ type: "upload", entity: IMPORT_ENTITIES[0] });
  }

  function nextEntity(current: ImportEntity) {
    const idx = IMPORT_ENTITIES.indexOf(current);
    if (idx < IMPORT_ENTITIES.length - 1) {
      setStep({ type: "upload", entity: IMPORT_ENTITIES[idx + 1] });
    } else {
      finishImport();
    }
  }

  async function finishImport() {
    if (jobId) {
      await completeImportJob(jobId, results);
    }
    setStep({ type: "summary" });
  }

  function handleDataReady(
    entity: ImportEntity,
    rows: Record<string, string>[],
    teamRows?: Record<string, string>[],
  ) {
    setStep({ type: "preview", entity, rows, teamRows });
  }

  function handleImportComplete(entity: ImportEntity, result: ImportResult) {
    setResults((prev) => ({ ...prev, [entity]: result }));
    nextEntity(entity);
  }

  return (
    <div>
      <ProgressBar currentStep={currentStepId} />

      {step.type === "welcome" && (
        <StepWelcome onStart={handleStart} />
      )}

      {step.type === "upload" && (
        <StepUpload
          key={step.entity}
          entity={step.entity}
          onDataReady={(rows, teamRows) =>
            handleDataReady(step.entity, rows, teamRows)
          }
          onSkip={() => nextEntity(step.entity)}
        />
      )}

      {step.type === "preview" && (
        <StepPreview
          key={step.entity}
          entity={step.entity}
          rows={step.rows}
          teamRows={step.teamRows}
          onImport={ENTITY_ACTIONS[step.entity]}
          onComplete={(result) =>
            handleImportComplete(step.entity, result)
          }
          onBack={() =>
            setStep({ type: "upload", entity: step.entity })
          }
        />
      )}

      {step.type === "summary" && (
        <StepSummary
          results={results}
          onDone={() => router.push("/dashboard")}
        />
      )}
    </div>
  );
}
