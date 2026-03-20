import { describe, expect, it } from "vitest";
import {
  formatBookingDate,
  formatCredits,
  formatDuration,
  formatTimeRange,
  getBusinessHoursDuration,
  getBusinessHoursForDate,
  getDateRange,
  getDayKey,
  toLocal,
  toUTC,
  type BusinessHours,
} from "./format";

const TZ = "Europe/Madrid";
const TZ_NY = "America/New_York";

// ── toUTC ───────────────────────────────────────────────────────────────

describe("toUTC", () => {
  it("converts CET local time to UTC (winter, UTC+1)", () => {
    // 2026-01-15 09:00 CET → 08:00 UTC
    const result = toUTC("2026-01-15", "09:00", TZ);
    expect(result).toBe("2026-01-15T08:00:00.000Z");
  });

  it("converts CEST local time to UTC (summer, UTC+2)", () => {
    // 2026-07-15 09:00 CEST → 07:00 UTC
    const result = toUTC("2026-07-15", "09:00", TZ);
    expect(result).toBe("2026-07-15T07:00:00.000Z");
  });

  it("round-trips with toLocal", () => {
    const utc = toUTC("2026-03-11", "14:30", TZ);
    const local = toLocal(utc, TZ);
    expect(local.year).toBe(2026);
    expect(local.month).toBe(3);
    expect(local.day).toBe(11);
    expect(local.hour).toBe(14);
    expect(local.minute).toBe(30);
  });

  it("handles midnight (00:00)", () => {
    const result = toUTC("2026-06-15", "00:00", TZ);
    // 00:00 CEST → 22:00 UTC previous day
    expect(result).toBe("2026-06-14T22:00:00.000Z");
  });

  it("handles a negative-offset timezone (America/New_York)", () => {
    // 2026-01-15 09:00 EST (UTC-5) → 14:00 UTC
    const result = toUTC("2026-01-15", "09:00", TZ_NY);
    expect(result).toBe("2026-01-15T14:00:00.000Z");
  });

  it("handles DST spring-forward boundary (Europe/Madrid clocks skip 02:00→03:00)", () => {
    // Spain DST 2026: clocks spring forward on March 29 at 02:00 → 03:00
    // 03:00 CEST (UTC+2) → 01:00 UTC
    const result = toUTC("2026-03-29", "03:00", TZ);
    expect(result).toBe("2026-03-29T01:00:00.000Z");
  });

  it("handles DST fall-back boundary (Europe/Madrid clocks go back 03:00→02:00)", () => {
    // Spain DST 2026: clocks fall back on October 25 at 03:00 → 02:00
    // 04:00 CET (UTC+1) → 03:00 UTC
    const result = toUTC("2026-10-25", "04:00", TZ);
    expect(result).toBe("2026-10-25T03:00:00.000Z");
  });
});

// ── toLocal ─────────────────────────────────────────────────────────────

describe("toLocal", () => {
  it("converts UTC to CET parts (winter)", () => {
    const local = toLocal("2026-01-15T08:00:00.000Z", TZ);
    expect(local).toEqual({ year: 2026, month: 1, day: 15, hour: 9, minute: 0 });
  });

  it("converts UTC to CEST parts (summer)", () => {
    const local = toLocal("2026-07-15T07:00:00.000Z", TZ);
    expect(local).toEqual({ year: 2026, month: 7, day: 15, hour: 9, minute: 0 });
  });

  it("converts UTC midnight to local next-day in positive-offset timezone", () => {
    // 2026-01-14 23:30 UTC → 2026-01-15 00:30 CET
    const local = toLocal("2026-01-14T23:30:00.000Z", TZ);
    expect(local).toEqual({ year: 2026, month: 1, day: 15, hour: 0, minute: 30 });
  });

  it("handles a negative-offset timezone (America/New_York)", () => {
    // 2026-01-15 14:00 UTC → 09:00 EST (UTC-5)
    const local = toLocal("2026-01-15T14:00:00.000Z", TZ_NY);
    expect(local).toEqual({ year: 2026, month: 1, day: 15, hour: 9, minute: 0 });
  });

  it("handles UTC midnight exactly", () => {
    // 2026-06-15 00:00 UTC → 02:00 CEST (UTC+2)
    const local = toLocal("2026-06-15T00:00:00.000Z", TZ);
    expect(local).toEqual({ year: 2026, month: 6, day: 15, hour: 2, minute: 0 });
  });
});

// ── formatTimeRange ─────────────────────────────────────────────────────

describe("formatTimeRange", () => {
  it("formats a time range in local timezone", () => {
    // 08:00 UTC → 09:00 CET, 16:00 UTC → 17:00 CET
    const result = formatTimeRange(
      "2026-01-15T08:00:00.000Z",
      "2026-01-15T16:00:00.000Z",
      TZ,
    );
    expect(result).toBe("09:00 – 17:00");
  });

  it("formats a short 1-hour range", () => {
    const result = formatTimeRange(
      "2026-01-15T10:00:00.000Z",
      "2026-01-15T11:00:00.000Z",
      TZ,
    );
    expect(result).toBe("11:00 – 12:00");
  });

  it("formats a range during summer time (CEST, UTC+2)", () => {
    // 07:00 UTC → 09:00 CEST, 15:00 UTC → 17:00 CEST
    const result = formatTimeRange(
      "2026-07-15T07:00:00.000Z",
      "2026-07-15T15:00:00.000Z",
      TZ,
    );
    expect(result).toBe("09:00 – 17:00");
  });

  it("includes half-hour minutes correctly", () => {
    const result = formatTimeRange(
      "2026-01-15T08:30:00.000Z",
      "2026-01-15T10:45:00.000Z",
      TZ,
    );
    expect(result).toBe("09:30 – 11:45");
  });
});

// ── formatBookingDate ───────────────────────────────────────────────────

describe("formatBookingDate", () => {
  it("formats a date as long weekday + month + day + year", () => {
    // 2026-03-11 is a Wednesday
    const result = formatBookingDate("2026-03-11T10:00:00.000Z", TZ);
    expect(result).toBe("Wednesday, March 11, 2026");
  });

  it("formats a weekend date correctly", () => {
    // 2026-03-15 is a Sunday
    const result = formatBookingDate("2026-03-15T10:00:00.000Z", TZ);
    expect(result).toBe("Sunday, March 15, 2026");
  });

  it("handles date near UTC midnight where timezone shifts the date forward", () => {
    // 2026-01-14 23:30 UTC → 2026-01-15 00:30 CET — should display Jan 15
    const result = formatBookingDate("2026-01-14T23:30:00.000Z", TZ);
    expect(result).toBe("Thursday, January 15, 2026");
  });

  it("formats a New Year date correctly", () => {
    const result = formatBookingDate("2026-01-01T10:00:00.000Z", TZ);
    expect(result).toBe("Thursday, January 1, 2026");
  });
});

// ── formatDuration ──────────────────────────────────────────────────────

describe("formatDuration", () => {
  it("formats hours only", () => {
    expect(formatDuration(120)).toBe("2h");
  });

  it("formats minutes only", () => {
    expect(formatDuration(45)).toBe("45m");
  });

  it("formats mixed hours and minutes", () => {
    expect(formatDuration(90)).toBe("1h 30m");
  });

  it("formats zero minutes", () => {
    expect(formatDuration(0)).toBe("0m");
  });

  it("formats exactly one minute", () => {
    expect(formatDuration(1)).toBe("1m");
  });

  it("formats exactly one hour", () => {
    expect(formatDuration(60)).toBe("1h");
  });

  it("formats large durations (full workday)", () => {
    expect(formatDuration(480)).toBe("8h");
  });

  it("formats 59 minutes (just under an hour)", () => {
    expect(formatDuration(59)).toBe("59m");
  });

  it("formats 61 minutes (just over an hour)", () => {
    expect(formatDuration(61)).toBe("1h 1m");
  });
});

// ── formatCredits ───────────────────────────────────────────────────────

describe("formatCredits", () => {
  it("delegates to formatDuration", () => {
    expect(formatCredits(90)).toBe("1h 30m");
    expect(formatCredits(60)).toBe("1h");
  });

  it("formats zero credits", () => {
    expect(formatCredits(0)).toBe("0m");
  });

  it("formats small credit amounts", () => {
    expect(formatCredits(15)).toBe("15m");
  });
});

// ── getDayKey ───────────────────────────────────────────────────────────

describe("getDayKey", () => {
  it("returns correct day for known dates", () => {
    // 2026-03-11 is a Wednesday
    expect(getDayKey("2026-03-11", TZ)).toBe("wed");
    // 2026-03-15 is a Sunday
    expect(getDayKey("2026-03-15", TZ)).toBe("sun");
    // 2026-03-09 is a Monday
    expect(getDayKey("2026-03-09", TZ)).toBe("mon");
  });

  it("returns all seven day keys across a full week", () => {
    // 2026-03-09 (Mon) through 2026-03-15 (Sun)
    expect(getDayKey("2026-03-09", TZ)).toBe("mon");
    expect(getDayKey("2026-03-10", TZ)).toBe("tue");
    expect(getDayKey("2026-03-11", TZ)).toBe("wed");
    expect(getDayKey("2026-03-12", TZ)).toBe("thu");
    expect(getDayKey("2026-03-13", TZ)).toBe("fri");
    expect(getDayKey("2026-03-14", TZ)).toBe("sat");
    expect(getDayKey("2026-03-15", TZ)).toBe("sun");
  });

  it("handles a different timezone correctly", () => {
    // 2026-03-11 Wed in Madrid — should also be Wed in New York
    expect(getDayKey("2026-03-11", TZ_NY)).toBe("wed");
  });
});

// ── getBusinessHoursForDate ─────────────────────────────────────────────

describe("getBusinessHoursForDate", () => {
  const bh: BusinessHours = {
    mon: { open: "09:00", close: "18:00" },
    wed: { open: "10:00", close: "17:00" },
    sun: null,
  };

  it("returns hours for an open day", () => {
    // 2026-03-11 = Wednesday
    expect(getBusinessHoursForDate(bh, "2026-03-11", TZ)).toEqual({
      open: "10:00",
      close: "17:00",
    });
  });

  it("returns null for a closed day (explicitly null)", () => {
    // 2026-03-15 = Sunday
    expect(getBusinessHoursForDate(bh, "2026-03-15", TZ)).toBeNull();
  });

  it("returns null for a day not in the map", () => {
    // 2026-03-10 = Tuesday, not in bh
    expect(getBusinessHoursForDate(bh, "2026-03-10", TZ)).toBeNull();
  });

  it("returns null for an empty business hours object", () => {
    expect(getBusinessHoursForDate({}, "2026-03-11", TZ)).toBeNull();
  });
});

// ── getBusinessHoursDuration ────────────────────────────────────────────

describe("getBusinessHoursDuration", () => {
  const bh: BusinessHours = {
    mon: { open: "09:00", close: "18:00" },
    tue: { open: "08:30", close: "12:30" },
    sun: null,
  };

  it("returns correct minutes for an open day", () => {
    // 2026-03-09 = Monday → 9h = 540 minutes
    expect(getBusinessHoursDuration(bh, "2026-03-09", TZ)).toBe(540);
  });

  it("returns 0 for a closed day", () => {
    expect(getBusinessHoursDuration(bh, "2026-03-15", TZ)).toBe(0);
  });

  it("returns 0 for a day not in the map", () => {
    // 2026-03-11 = Wednesday, not in bh
    expect(getBusinessHoursDuration(bh, "2026-03-11", TZ)).toBe(0);
  });

  it("handles half-hour boundaries correctly", () => {
    // 2026-03-10 = Tuesday → 08:30 to 12:30 = 4h = 240 minutes
    expect(getBusinessHoursDuration(bh, "2026-03-10", TZ)).toBe(240);
  });
});

// ── getDateRange ────────────────────────────────────────────────────────

describe("getDateRange", () => {
  it("returns inclusive range of dates", () => {
    const range = getDateRange("2026-03-09", "2026-03-12");
    expect(range).toEqual(["2026-03-09", "2026-03-10", "2026-03-11", "2026-03-12"]);
  });

  it("returns single date when start equals end", () => {
    expect(getDateRange("2026-03-11", "2026-03-11")).toEqual(["2026-03-11"]);
  });

  it("returns empty array when end is before start", () => {
    expect(getDateRange("2026-03-12", "2026-03-09")).toEqual([]);
  });

  it("spans a month boundary correctly", () => {
    const range = getDateRange("2026-03-30", "2026-04-02");
    expect(range).toEqual(["2026-03-30", "2026-03-31", "2026-04-01", "2026-04-02"]);
  });

  it("spans a year boundary correctly", () => {
    const range = getDateRange("2025-12-30", "2026-01-02");
    expect(range).toEqual(["2025-12-30", "2025-12-31", "2026-01-01", "2026-01-02"]);
  });

  it("handles a longer range (full week)", () => {
    const range = getDateRange("2026-03-09", "2026-03-15");
    expect(range).toHaveLength(7);
    expect(range[0]).toBe("2026-03-09");
    expect(range[6]).toBe("2026-03-15");
  });

  it("handles February end in a non-leap year", () => {
    const range = getDateRange("2026-02-27", "2026-03-01");
    expect(range).toEqual(["2026-02-27", "2026-02-28", "2026-03-01"]);
  });
});
