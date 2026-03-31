"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { log } from "@cowork/shared";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    log.error("Unhandled error", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="max-w-md text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
        <h2 className="mt-4 text-xl font-semibold tracking-tight">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected error occurred. Please try again.
        </p>
        {process.env.NODE_ENV === "development" && error.digest && (
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            Digest: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
