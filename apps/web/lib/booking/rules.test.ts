import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BusinessHours } from "./format";
import {
  canCancelBooking,
  getAdvanceBookingLimit,
  validateBookingTime,
  validateDeskBookingDate,
} from "./rules";

const TZ = "Europe/Madrid";

const WEEKDAY_HOURS: BusinessHours = {
  mon: { open: "09:00", close: "18:00" },
  tue: { open: "09:00", close: "18:00" },
  wed: { open: "09:00", close: "18:00" },
  thu: { open: "09:00", close: "18:00" },
  fri: { open: "09:00", close: "18:00" },
};

// ── validateBookingTime ─────────────────────────────────────────────────

describe("validateBookingTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Freeze at 2026-03-11 08:00 UTC (09:00 CET, Wednesday)
    vi.setSystemTime(new Date("2026-03-11T08:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects bookings in the past", () => {
    const result = validateBookingTime(
      "2026-03-11T07:00:00.000Z",
      "2026-03-11T08:00:00.000Z",
      WEEKDAY_HOURS,
      TZ,
      [],
    );
    expect(result).toEqual({ valid: false, error: "Cannot book in the past" });
  });

  it("rejects when end is before start", () => {
    const result = validateBookingTime(
      "2026-03-11T10:00:00.000Z",
      "2026-03-11T09:00:00.000Z",
      WEEKDAY_HOURS,
      TZ,
      [],
    );
    expect(result).toEqual({ valid: false, error: "End time must be after start time" });
  });

  it("rejects when end equals start", () => {
    const result = validateBookingTime(
      "2026-03-11T10:00:00.000Z",
      "2026-03-11T10:00:00.000Z",
      WEEKDAY_HOURS,
      TZ,
      [],
    );
    expect(result).toEqual({ valid: false, error: "End time must be after start time" });
  });

  it("rejects on a closed day (no business hours)", () => {
    // Saturday is not in WEEKDAY_HOURS → 2026-03-14 is Saturday
    const result = validateBookingTime(
      "2026-03-14T09:00:00.000Z",
      "2026-03-14T10:00:00.000Z",
      WEEKDAY_HOURS,
      TZ,
      [],
    );
    expect(result).toEqual({ valid: false, error: "The space is closed on this day" });
  });

  it("rejects on a closure date", () => {
    const result = validateBookingTime(
      "2026-03-12T09:00:00.000Z",
      "2026-03-12T10:00:00.000Z",
      WEEKDAY_HOURS,
      TZ,
      ["2026-03-12"],
    );
    expect(result).toEqual({ valid: false, error: "The space is closed on this date" });
  });

  it("rejects when start is before opening", () => {
    // 07:00 UTC = 08:00 CET, opens at 09:00 CET
    const result = validateBookingTime(
      "2026-03-12T07:00:00.000Z",
      "2026-03-12T08:00:00.000Z",
      WEEKDAY_HOURS,
      TZ,
      [],
    );
    expect(result).toEqual({ valid: false, error: "Start time is outside business hours" });
  });

  it("rejects when start is at or after closing", () => {
    // 17:00 UTC = 18:00 CET, closes at 18:00 CET
    const result = validateBookingTime(
      "2026-03-12T17:00:00.000Z",
      "2026-03-12T18:00:00.000Z",
      WEEKDAY_HOURS,
      TZ,
      [],
    );
    expect(result).toEqual({ valid: false, error: "Start time is outside business hours" });
  });

  it("rejects when end is after closing", () => {
    // 16:30 UTC = 17:30 CET start, 17:30 UTC = 18:30 CET end, closes 18:00 CET
    const result = validateBookingTime(
      "2026-03-12T16:30:00.000Z",
      "2026-03-12T17:30:00.000Z",
      WEEKDAY_HOURS,
      TZ,
      [],
    );
    expect(result).toEqual({ valid: false, error: "End time is outside business hours" });
  });

  it("rejects when duration is less than default minimum (60 min)", () => {
    // 09:00 UTC = 10:00 CET, 09:30 UTC = 10:30 CET (30 min, under 60 min default)
    const result = validateBookingTime(
      "2026-03-12T09:00:00.000Z",
      "2026-03-12T09:30:00.000Z",
      WEEKDAY_HOURS,
      TZ,
      [],
    );
    expect(result).toEqual({ valid: false, error: "Minimum booking is 1 hour" });
  });

  it("rejects when duration is less than custom minimum (15 min)", () => {
    // 09:00 UTC = 10:00 CET, 09:10 UTC = 10:10 CET (10 min, under 15 min custom)
    const result = validateBookingTime(
      "2026-03-12T09:00:00.000Z",
      "2026-03-12T09:10:00.000Z",
      WEEKDAY_HOURS,
      TZ,
      [],
      15,
    );
    expect(result).toEqual({ valid: false, error: "Minimum booking is 15 minutes" });
  });

  it("rejects when duration exceeds 240 minutes", () => {
    // 08:00 UTC = 09:00 CET, 13:01 UTC = 14:01 CET (301 min)
    const result = validateBookingTime(
      "2026-03-12T08:00:00.000Z",
      "2026-03-12T13:01:00.000Z",
      WEEKDAY_HOURS,
      TZ,
      [],
    );
    expect(result).toEqual({ valid: false, error: "Maximum booking is 4 hours" });
  });

  it("accepts a valid booking within hours", () => {
    // 09:00 UTC = 10:00 CET, 11:00 UTC = 12:00 CET (2h)
    const result = validateBookingTime(
      "2026-03-12T09:00:00.000Z",
      "2026-03-12T11:00:00.000Z",
      WEEKDAY_HOURS,
      TZ,
      [],
    );
    expect(result).toEqual({ valid: true });
  });
});

// ── validateDeskBookingDate ─────────────────────────────────────────────

describe("validateDeskBookingDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Freeze at 2026-03-11 08:00 UTC (09:00 CET, Wednesday)
    vi.setSystemTime(new Date("2026-03-11T08:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects a past date", () => {
    const result = validateDeskBookingDate("2026-03-10", WEEKDAY_HOURS, TZ, []);
    expect(result).toEqual({ valid: false, error: "Cannot book in the past" });
  });

  it("rejects a date beyond the advance limit (14 days)", () => {
    const result = validateDeskBookingDate("2026-03-30", WEEKDAY_HOURS, TZ, []);
    expect(result).toEqual({
      valid: false,
      error: "Cannot book more than 14 days in advance",
    });
  });

  it("rejects a closure date", () => {
    const result = validateDeskBookingDate("2026-03-12", WEEKDAY_HOURS, TZ, ["2026-03-12"]);
    expect(result).toEqual({ valid: false, error: "The space is closed on this date" });
  });

  it("rejects a closed day (no business hours)", () => {
    // 2026-03-14 = Saturday
    const result = validateDeskBookingDate("2026-03-14", WEEKDAY_HOURS, TZ, []);
    expect(result).toEqual({ valid: false, error: "The space is closed on this day" });
  });

  it("accepts a valid future weekday", () => {
    const result = validateDeskBookingDate("2026-03-12", WEEKDAY_HOURS, TZ, []);
    expect(result).toEqual({ valid: true });
  });
});

// ── canCancelBooking ────────────────────────────────────────────────────

describe("canCancelBooking", () => {
  const now = new Date("2026-03-11T10:00:00.000Z");

  it("rejects already-cancelled booking", () => {
    expect(
      canCancelBooking({ start_time: "2026-03-12T10:00:00.000Z", status: "cancelled" }, now),
    ).toEqual({ canCancel: false, willRefund: false, reason: "Booking is already cancelled" });
  });

  it("rejects already-completed booking", () => {
    expect(
      canCancelBooking({ start_time: "2026-03-10T10:00:00.000Z", status: "completed" }, now),
    ).toEqual({ canCancel: false, willRefund: false, reason: "Booking is already completed" });
  });

  it("rejects booking that has already started", () => {
    expect(
      canCancelBooking({ start_time: "2026-03-11T09:00:00.000Z", status: "confirmed" }, now),
    ).toEqual({ canCancel: false, willRefund: false, reason: "Booking has already started" });
  });

  it("allows cancelling a future booking with refund", () => {
    const result = canCancelBooking(
      { start_time: "2026-03-12T10:00:00.000Z", status: "confirmed" },
      now,
    );
    expect(result.canCancel).toBe(true);
    expect(result.willRefund).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("flags late cancellation when less than 2h before start", () => {
    const result = canCancelBooking(
      { start_time: "2026-03-11T11:30:00.000Z", status: "confirmed" },
      now,
    );
    expect(result.canCancel).toBe(true);
    expect(result.willRefund).toBe(true);
    expect(result.reason).toBe("Late cancellation");
  });
});

// ── getAdvanceBookingLimit ──────────────────────────────────────────────

describe("getAdvanceBookingLimit", () => {
  it("returns 14", () => {
    expect(getAdvanceBookingLimit()).toBe(14);
  });
});
