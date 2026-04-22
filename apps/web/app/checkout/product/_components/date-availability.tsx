interface DateAvailabilityProps {
  checking: boolean;
  availability: {
    available: boolean;
    spots_left: number | null;
    reason?: string;
    has_existing_pass?: boolean;
  } | null;
}

export function DateAvailability({
  checking,
  availability,
}: DateAvailabilityProps) {
  if (checking) {
    return (
      <p className="text-sm text-muted-foreground">Checking availability...</p>
    );
  }

  if (!availability) return null;

  if (!availability.available) {
    return (
      <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {availability.reason ?? "No spots available on this date"}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {availability.spots_left !== null && availability.spots_left <= 5 ? (
        <p className="text-center text-sm text-amber-600">
          Only {availability.spots_left}{" "}
          {availability.spots_left === 1 ? "spot" : "spots"} left
        </p>
      ) : (
        <p className="text-center text-sm text-emerald-600">Available</p>
      )}
      {availability.has_existing_pass && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          You already have a pass for overlapping dates. You can still proceed.
        </p>
      )}
    </div>
  );
}
