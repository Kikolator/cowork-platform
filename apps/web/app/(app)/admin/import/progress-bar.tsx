"use client";

import { IMPORT_ENTITIES, ENTITY_MAPPINGS, type ImportEntity } from "./mappings";

const ALL_STEPS = ["welcome", ...IMPORT_ENTITIES, "summary"] as const;
type StepId = (typeof ALL_STEPS)[number];

interface ProgressBarProps {
  currentStep: StepId;
}

function getStepLabel(step: StepId): string {
  if (step === "welcome") return "Start";
  if (step === "summary") return "Summary";
  return ENTITY_MAPPINGS[step as ImportEntity].displayName;
}

export function ProgressBar({ currentStep }: ProgressBarProps) {
  const currentIndex = ALL_STEPS.indexOf(currentStep);

  return (
    <nav aria-label="Import progress" className="mb-8">
      <ol className="flex items-center gap-1">
        {ALL_STEPS.map((step, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          return (
            <li key={step} className="flex items-center gap-1">
              <div
                className={`flex h-7 items-center rounded-full px-3 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isCompleted
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {getStepLabel(step)}
              </div>
              {index < ALL_STEPS.length - 1 && (
                <div
                  className={`h-px w-4 ${
                    isCompleted ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
