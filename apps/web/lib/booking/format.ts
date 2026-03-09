/**
 * Timezone-aware date/time formatting helpers for the booking system.
 *
 * All DB timestamps are stored as timestamptz (UTC). These helpers convert
 * between the space's local timezone and UTC, and format for display.
 */

// ── Types ──────────────────────────────────────────────────────────────

export interface DayHours {
  open: string; // "09:00"
  close: string; // "18:00"
}

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type BusinessHours = Partial<Record<DayKey, DayHours | null>>;

// ── Timezone conversion ────────────────────────────────────────────────

/**
 * Convert a local date + time in a timezone to a UTC ISO string.
 *
 * Example: toUTC("2026-03-11", "09:00", "Europe/Madrid")
 * → "2026-03-11T08:00:00.000Z" (09:00 CET = 08:00 UTC)
 */
export function toUTC(dateStr: string, timeStr: string, timezone: string): string {
  const year = parseInt(dateStr.slice(0, 4), 10);
  const month = parseInt(dateStr.slice(5, 7), 10) - 1;
  const day = parseInt(dateStr.slice(8, 10), 10);
  const hour = parseInt(timeStr.slice(0, 2), 10);
  const minute = parseInt(timeStr.slice(3, 5), 10);

  // Treat the target local time as if it were UTC
  const guessMs = Date.UTC(year, month, day, hour, minute);
  const guessDate = new Date(guessMs);

  // See what this UTC instant looks like in the target timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(guessDate).map((p) => [p.type, p.value]),
  );

  const localMs = Date.UTC(
    parseInt(parts.year!, 10),
    parseInt(parts.month!, 10) - 1,
    parseInt(parts.day!, 10),
    parseInt(parts.hour!, 10) % 24, // Intl may return "24" for midnight
    parseInt(parts.minute!, 10),
  );

  // The offset is how far the timezone shifts from UTC
  const offsetMs = guessMs - localMs;
  return new Date(guessMs + offsetMs).toISOString();
}

/**
 * Convert a UTC ISO string to local parts in a timezone.
 */
export function toLocal(
  utcIso: string,
  timezone: string,
): { year: number; month: number; day: number; hour: number; minute: number } {
  const d = new Date(utcIso);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(d).map((p) => [p.type, p.value]),
  );
  return {
    year: parseInt(parts.year!, 10),
    month: parseInt(parts.month!, 10),
    day: parseInt(parts.day!, 10),
    hour: parseInt(parts.hour!, 10) % 24,
    minute: parseInt(parts.minute!, 10),
  };
}

// ── Display formatting ─────────────────────────────────────────────────

/** "09:00 – 18:00" */
export function formatTimeRange(startUtc: string, endUtc: string, timezone: string): string {
  const start = new Date(startUtc);
  const end = new Date(endUtc);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

/** "Wednesday, March 11, 2026" */
export function formatBookingDate(dateUtcOrLocal: string, timezone: string): string {
  const d = new Date(dateUtcOrLocal);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

/** "1h 30m" or "9h" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Same format as duration but semantically represents credits. */
export function formatCredits(minutes: number): string {
  return formatDuration(minutes);
}

// ── Business hours helpers ─────────────────────────────────────────────

const DAY_KEYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/**
 * Get the day key (mon, tue, ...) for a date string in a timezone.
 */
export function getDayKey(dateStr: string, timezone: string): DayKey {
  const d = new Date(dateStr + "T12:00:00Z"); // noon UTC avoids date-boundary issues
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  });
  const dayName = formatter.format(d).toLowerCase().slice(0, 3);
  // Intl returns "mon", "tue", etc.
  return dayName as DayKey;
}

/**
 * Get business hours for a specific date. Returns null if closed that day.
 */
export function getBusinessHoursForDate(
  businessHours: BusinessHours,
  dateStr: string,
  timezone: string,
): DayHours | null {
  const key = getDayKey(dateStr, timezone);
  const hours = businessHours[key];
  return hours ?? null;
}

/**
 * Calculate business hours duration in minutes for a given date.
 * Returns 0 if closed.
 */
export function getBusinessHoursDuration(
  businessHours: BusinessHours,
  dateStr: string,
  timezone: string,
): number {
  const hours = getBusinessHoursForDate(businessHours, dateStr, timezone);
  if (!hours) return 0;

  const [openH, openM] = hours.open.split(":").map(Number) as [number, number];
  const [closeH, closeM] = hours.close.split(":").map(Number) as [number, number];
  return (closeH * 60 + closeM) - (openH * 60 + openM);
}

/**
 * Get all dates in a range (inclusive). Returns YYYY-MM-DD strings.
 */
export function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + "T12:00:00Z");
  const end = new Date(endDate + "T12:00:00Z");

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}
