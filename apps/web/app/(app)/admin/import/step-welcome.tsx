"use client";

import { useState, useTransition } from "react";
import { Upload, FileSpreadsheet, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createImportJob } from "./actions";

interface StepWelcomeProps {
  onStart: (jobId: string) => void;
}

export function StepWelcome({ onStart }: StepWelcomeProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleStart() {
    setError(null);
    startTransition(async () => {
      const result = await createImportJob();
      if (result.success) {
        onStart(result.jobId);
      } else {
        setError(result.error);
      }
    });
  }

  const steps = [
    {
      title: "Export your data from OfficeRnd",
      description:
        'Go to OfficeRnd Data Hub, select each data type, and export as CSV.',
    },
    {
      title: "Upload CSV files in order",
      description:
        "The wizard guides you through each data type: resource types, resources, plans, members, bookings, and leads.",
    },
    {
      title: "Review and confirm",
      description:
        "Preview your data, check for errors, and confirm each import step. You can skip any step.",
    },
    {
      title: "Invite your members",
      description:
        "After importing, send magic link invites so members can access their accounts.",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <div className="rounded-lg bg-primary/10 p-3">
          <Upload className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">
            Import from OfficeRnd
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Migrate your coworking space data from OfficeRnd in a few simple
            steps. Each step is optional and safe to re-run.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium">How it works</h3>
        <ol className="space-y-4">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {i + 1}
              </div>
              <div>
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-xs text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-lg bg-muted/50 p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileSpreadsheet className="h-4 w-4" />
          What you&apos;ll need
        </div>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li>CSV exports from OfficeRnd Data Hub (one per data type)</li>
          <li>Available data types: resource types, resources, plans, members, bookings, leads</li>
          <li>Each CSV file should have column headers in the first row</li>
        </ul>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={handleStart} disabled={isPending} size="lg">
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ArrowRight className="mr-2 h-4 w-4" />
        )}
        Start Import
      </Button>
    </div>
  );
}
