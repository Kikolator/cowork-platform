import "server-only";

import type { BusinessHours } from "./format";
import { getBusinessHoursForDate, toLocal } from "./format";

// ── Types ──────────────────────────────────────────────────────────────

interface ValidationResult {
  valid: boolean;
  error?: string;
}

interface CancelResult {
  canCancel: boolean;
  willRefund: boolean;
  reason?: string;
}

interface BookingForCancel {
  start_time: string;
  status: string;
}

// ── Validation ─────────────────────────────────────────────────────────

/**
 * Validate that a booking time range is within business hours
 * and doesn't fall on a closed day.
 */
export function validateBookingTime(
  startTimeUtc: string,
  endTimeUtc: string,
  businessHours: BusinessHours,
  timezone: string,
  closures: string[],
): ValidationResult {
  const now = new Date();
  const start = new Date(startTimeUtc);
  const end = new Date(endTimeUtc);

  // Can't book in the past
  if (start < now) {
    return { valid: false, error: "Cannot book in the past" };
  }

  // End must be after start
  if (end <= start) {
    return { valid: false, error: "End time must be after start time" };
  }

  // Get the date string in the space timezone
  const local = toLocal(startTimeUtc, timezone);
  const dateStr = `${local.year}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;

  // Check closures
  if (closures.includes(dateStr)) {
    return { valid: false, error: "The space is closed on this date" };
  }

  // Check business hours
  const hours = getBusinessHoursForDate(businessHours, dateStr, timezone);
  if (!hours) {
    return { valid: false, error: "The space is closed on this day" };
  }

  // Verify start and end are within business hours
  const startLocal = toLocal(startTimeUtc, timezone);
  const endLocal = toLocal(endTimeUtc, timezone);
  const [openH, openM] = hours.open.split(":").map(Number) as [number, number];
  const [closeH, closeM] = hours.close.split(":").map(Number) as [number, number];

  const startMinutes = startLocal.hour * 60 + startLocal.minute;
  const endMinutes = endLocal.hour * 60 + endLocal.minute;
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  if (startMinutes < openMinutes || startMinutes >= closeMinutes) {
    return { valid: false, error: "Start time is outside business hours" };
  }

  if (endMinutes <= openMinutes || endMinutes > closeMinutes) {
    return { valid: false, error: "End time is outside business hours" };
  }

  // Duration checks
  const durationMinutes = (end.getTime() - start.getTime()) / 60_000;
  if (durationMinutes < 30) {
    return { valid: false, error: "Minimum booking is 30 minutes" };
  }
  if (durationMinutes > 240) {
    return { valid: false, error: "Maximum booking is 4 hours" };
  }

  return { valid: true };
}

/**
 * Validate a desk booking date.
 */
export function validateDeskBookingDate(
  dateStr: string,
  businessHours: BusinessHours,
  timezone: string,
  closures: string[],
): ValidationResult {
  // Can't book in the past
  const today = new Date();
  const todayStr = toLocal(today.toISOString(), timezone);
  const todayDate = `${todayStr.year}-${String(todayStr.month).padStart(2, "0")}-${String(todayStr.day).padStart(2, "0")}`;

  if (dateStr < todayDate) {
    return { valid: false, error: "Cannot book in the past" };
  }

  // Check advance booking limit
  const limit = getAdvanceBookingLimit();
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + limit);
  const maxDateStr = maxDate.toISOString().slice(0, 10);

  if (dateStr > maxDateStr) {
    return { valid: false, error: `Cannot book more than ${limit} days in advance` };
  }

  // Check closures
  if (closures.includes(dateStr)) {
    return { valid: false, error: "The space is closed on this date" };
  }

  // Check business hours
  const hours = getBusinessHoursForDate(businessHours, dateStr, timezone);
  if (!hours) {
    return { valid: false, error: "The space is closed on this day" };
  }

  return { valid: true };
}

/**
 * Determine if a booking can be cancelled and whether credits will be refunded.
 * For v1, always refund regardless of timing (late cancellation penalty deferred).
 */
export function canCancelBooking(
  booking: BookingForCancel,
  now: Date = new Date(),
): CancelResult {
  if (booking.status === "cancelled") {
    return { canCancel: false, willRefund: false, reason: "Booking is already cancelled" };
  }

  if (booking.status === "completed") {
    return { canCancel: false, willRefund: false, reason: "Booking is already completed" };
  }

  const start = new Date(booking.start_time);
  if (start < now) {
    return { canCancel: false, willRefund: false, reason: "Booking has already started" };
  }

  // For v1: always refund. Track the warning for future use.
  const hoursUntilStart = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
  const willRefund = true; // v1: always refund

  return {
    canCancel: true,
    willRefund,
    reason: hoursUntilStart < 2 ? "Late cancellation" : undefined,
  };
}

/**
 * Get advance booking limit in days. Default 14, configurable per space in future.
 */
export function getAdvanceBookingLimit(): number {
  return 14;
}
