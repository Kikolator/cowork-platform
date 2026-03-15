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
});

// ── formatBookingDate ───────────────────────────────────────────────────

describe("formatBookingDate", () => {
  it("formats a date as long weekday + month + day + year", () => {
    // 2026-03-11 is a Wednesday
    const result = formatBookingDate("2026-03-11T10:00:00.000Z", TZ);
    expect(result).toBe("Wednesday, March 11, 2026");
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
});

// ── formatCredits ───────────────────────────────────────────────────────

describe("formatCredits", () => {
  it("delegates to formatDuration", () => {
    expect(formatCredits(90)).toBe("1h 30m");
    expect(formatCredits(60)).toBe("1h");
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
});

// ── getBusinessHoursDuration ────────────────────────────────────────────

describe("getBusinessHoursDuration", () => {
  const bh: BusinessHours = {
    mon: { open: "09:00", close: "18:00" },
    sun: null,
  };

  it("returns correct minutes for an open day", () => {
    // 2026-03-09 = Monday → 9h = 540 minutes
    expect(getBusinessHoursDuration(bh, "2026-03-09", TZ)).toBe(540);
  });

  it("returns 0 for a closed day", () => {
    expect(getBusinessHoursDuration(bh, "2026-03-15", TZ)).toBe(0);
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
});
