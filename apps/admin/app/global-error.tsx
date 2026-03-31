"use client";

import { useEffect } from "react";
import { log } from "@cowork/shared";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    log.error("Unhandled error (global)", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-50 font-sans antialiased">
        <div className="mx-auto max-w-md px-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            An unexpected error occurred. Please try again.
          </p>
          {process.env.NODE_ENV === "development" && error.digest && (
            <p className="mt-2 font-mono text-xs text-neutral-500">
              Digest: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            className="mt-6 rounded-md bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-100 hover:bg-neutral-700 transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
