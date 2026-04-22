interface DateAvailabilityProps {
  checking: boolean;
  availability: {
    available: boolean;
    spots_left: number | null;
    reason?: string;
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

  if (availability.spots_left !== null && availability.spots_left <= 5) {
    return (
      <p className="text-center text-sm text-amber-600">
        Only {availability.spots_left}{" "}
        {availability.spots_left === 1 ? "spot" : "spots"} left
      </p>
    );
  }

  return (
    <p className="text-center text-sm text-emerald-600">Available</p>
  );
}
