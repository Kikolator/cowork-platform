import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BusinessHours } from "@/lib/booking/format";
import { isSpaceClosedOnDate, calculatePassEndDate } from "./closures";

// ── Mock Supabase builder ─────────────────────────────────────────────────

function createMockAdmin(queryResult: { data: unknown; error: unknown } = { data: null, error: null }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(queryResult),
  };

  // For calculatePassEndDate, the chain resolves at lte (no maybeSingle)
  // We need to handle both patterns: chain ending with maybeSingle or resolving at lte
  const admin = {
    from: vi.fn().mockReturnValue(chain),
  };

  return { admin: admin as unknown as Parameters<typeof isSpaceClosedOnDate>[0], chain };
}

function createMockAdminForPassEndDate(
  closureDates: string[] = [],
) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockResolvedValue({
      data: closureDates.map((date) => ({ date })),
      error: null,
    }),
  };

  const admin = {
    from: vi.fn().mockReturnValue(chain),
  };

  return { admin: admin as unknown as Parameters<typeof calculatePassEndDate>[0], chain };
}

// ── Test data ─────────────────────────────────────────────────────────────

const TZ = "Europe/Amsterdam";
const SPACE_ID = "space-urban-hive-001";

const WEEKDAY_HOURS: BusinessHours = {
  mon: { open: "09:00", close: "18:00" },
  tue: { open: "09:00", close: "18:00" },
  wed: { open: "09:00", close: "18:00" },
  thu: { open: "09:00", close: "18:00" },
  fri: { open: "09:00", close: "18:00" },
};

const FULL_WEEK_HOURS: BusinessHours = {
  mon: { open: "09:00", close: "18:00" },
  tue: { open: "09:00", close: "18:00" },
  wed: { open: "09:00", close: "18:00" },
  thu: { open: "09:00", close: "18:00" },
  fri: { open: "09:00", close: "18:00" },
  sat: { open: "10:00", close: "16:00" },
  sun: { open: "10:00", close: "16:00" },
};

// ── isSpaceClosedOnDate ───────────────────────────────────────────────────

describe("isSpaceClosedOnDate", () => {
  it("returns closed when Saturday has no business hours", async () => {
    const { admin } = createMockAdmin();
    // 2026-03-14 is a Saturday
    const result = await isSpaceClosedOnDate(admin, SPACE_ID, "2026-03-14", WEEKDAY_HOURS, TZ);
    expect(result).toEqual({ closed: true, reason: "Space is closed on this day" });
  });

  it("returns closed when Sunday has no business hours", async () => {
    const { admin } = createMockAdmin();
    // 2026-03-15 is a Sunday
    const result = await isSpaceClosedOnDate(admin, SPACE_ID, "2026-03-15", WEEKDAY_HOURS, TZ);
    expect(result).toEqual({ closed: true, reason: "Space is closed on this day" });
  });

  it("does not query space_closures when business hours are null", async () => {
    const { admin, chain } = createMockAdmin();
    // Saturday = no business hours, should short-circuit before DB query
    await isSpaceClosedOnDate(admin, SPACE_ID, "2026-03-14", WEEKDAY_HOURS, TZ);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("returns open on a weekday with no closures", async () => {
    const { admin } = createMockAdmin({ data: null, error: null });
    // 2026-03-11 is a Wednesday
    const result = await isSpaceClosedOnDate(admin, SPACE_ID, "2026-03-11", WEEKDAY_HOURS, TZ);
    expect(result).toEqual({ closed: false });
  });

  it("returns closed with reason from space_closures table", async () => {
    const { admin } = createMockAdmin({
      data: { reason: "Public holiday", all_day: true },
      error: null,
    });
    const result = await isSpaceClosedOnDate(admin, SPACE_ID, "2026-03-12", WEEKDAY_HOURS, TZ);
    expect(result).toEqual({ closed: true, reason: "Closed: Public holiday" });
  });

  it("returns closed with default reason when closure has no reason", async () => {
    const { admin } = createMockAdmin({
      data: { reason: null, all_day: true },
      error: null,
    });
    const result = await isSpaceClosedOnDate(admin, SPACE_ID, "2026-03-12", WEEKDAY_HOURS, TZ);
    expect(result).toEqual({ closed: true, reason: "Space is closed on this day" });
  });

  it("returns closed with default reason when closure reason is empty string", async () => {
    const { admin } = createMockAdmin({
      data: { reason: "", all_day: true },
      error: null,
    });
    const result = await isSpaceClosedOnDate(admin, SPACE_ID, "2026-03-12", WEEKDAY_HOURS, TZ);
    // Empty string is falsy, so should use default reason
    expect(result).toEqual({ closed: true, reason: "Space is closed on this day" });
  });

  it("queries the correct table and filters", async () => {
    const { admin, chain } = createMockAdmin({ data: null, error: null });
    await isSpaceClosedOnDate(admin, SPACE_ID, "2026-03-12", WEEKDAY_HOURS, TZ);

    expect(admin.from).toHaveBeenCalledWith("space_closures");
    expect(chain.select).toHaveBeenCalledWith("reason, all_day");
    expect(chain.eq).toHaveBeenCalledWith("space_id", SPACE_ID);
    expect(chain.eq).toHaveBeenCalledWith("date", "2026-03-12");
    expect(chain.eq).toHaveBeenCalledWith("all_day", true);
  });

  it("returns open on Saturday when full-week hours include Saturday", async () => {
    const { admin } = createMockAdmin({ data: null, error: null });
    const result = await isSpaceClosedOnDate(admin, SPACE_ID, "2026-03-14", FULL_WEEK_HOURS, TZ);
    expect(result).toEqual({ closed: false });
  });
});

// ── calculatePassEndDate ──────────────────────────────────────────────────

describe("calculatePassEndDate", () => {
  it("returns startDate for a 1-day pass", async () => {
    const { admin } = createMockAdminForPassEndDate();
    const result = await calculatePassEndDate(admin, SPACE_ID, "2026-03-11", 1, WEEKDAY_HOURS, TZ);
    expect(result).toBe("2026-03-11");
  });

  it("returns startDate when durationDays is 0", async () => {
    const { admin } = createMockAdminForPassEndDate();
    const result = await calculatePassEndDate(admin, SPACE_ID, "2026-03-11", 0, WEEKDAY_HOURS, TZ);
    expect(result).toBe("2026-03-11");
  });

  it("calculates end date for a 5-day pass within a single week (Mon-Fri)", async () => {
    const { admin } = createMockAdminForPassEndDate();
    // Start Monday 2026-03-09, 5 weekdays = Mon-Fri → end on Friday 2026-03-13
    const result = await calculatePassEndDate(admin, SPACE_ID, "2026-03-09", 5, WEEKDAY_HOURS, TZ);
    expect(result).toBe("2026-03-13");
  });

  it("skips weekends for a pass spanning across a weekend", async () => {
    const { admin } = createMockAdminForPassEndDate();
    // Start Thursday 2026-03-12, need 3 days
    // Day 1: Thu 03-12, Day 2: Fri 03-13, skip Sat/Sun, Day 3: Mon 03-16
    const result = await calculatePassEndDate(admin, SPACE_ID, "2026-03-12", 3, WEEKDAY_HOURS, TZ);
    expect(result).toBe("2026-03-16");
  });

  it("skips closure dates", async () => {
    const { admin } = createMockAdminForPassEndDate(["2026-03-12"]);
    // Start Wed 2026-03-11, need 3 days
    // Day 1: Wed 03-11, skip Thu 03-12 (closure), Day 2: Fri 03-13, skip Sat/Sun, Day 3: Mon 03-16
    const result = await calculatePassEndDate(admin, SPACE_ID, "2026-03-11", 3, WEEKDAY_HOURS, TZ);
    expect(result).toBe("2026-03-16");
  });

  it("skips multiple consecutive closures", async () => {
    const { admin } = createMockAdminForPassEndDate(["2026-03-12", "2026-03-13"]);
    // Start Wed 2026-03-11, need 2 days
    // Day 1: Wed 03-11, skip Thu 03-12 (closure), skip Fri 03-13 (closure), skip Sat/Sun, Day 2: Mon 03-16
    const result = await calculatePassEndDate(admin, SPACE_ID, "2026-03-11", 2, WEEKDAY_HOURS, TZ);
    expect(result).toBe("2026-03-16");
  });

  it("skips both weekends and closures together", async () => {
    const { admin } = createMockAdminForPassEndDate(["2026-03-13"]);
    // Start Thu 2026-03-12, need 3 days
    // Day 1: Thu 03-12, skip Fri 03-13 (closure), skip Sat/Sun, Day 2: Mon 03-16, Day 3: Tue 03-17
    const result = await calculatePassEndDate(admin, SPACE_ID, "2026-03-12", 3, WEEKDAY_HOURS, TZ);
    expect(result).toBe("2026-03-17");
  });

  it("queries space_closures with correct filters", async () => {
    const { admin, chain } = createMockAdminForPassEndDate();
    await calculatePassEndDate(admin, SPACE_ID, "2026-03-11", 5, WEEKDAY_HOURS, TZ);

    expect(admin.from).toHaveBeenCalledWith("space_closures");
    expect(chain.select).toHaveBeenCalledWith("date");
    expect(chain.eq).toHaveBeenCalledWith("space_id", SPACE_ID);
    expect(chain.eq).toHaveBeenCalledWith("all_day", true);
    expect(chain.gte).toHaveBeenCalledWith("date", "2026-03-11");
  });

  it("handles a 2-day pass starting on Friday (skips weekend)", async () => {
    const { admin } = createMockAdminForPassEndDate();
    // Start Fri 2026-03-13, need 2 days
    // Day 1: Fri 03-13, skip Sat/Sun, Day 2: Mon 03-16
    const result = await calculatePassEndDate(admin, SPACE_ID, "2026-03-13", 2, WEEKDAY_HOURS, TZ);
    expect(result).toBe("2026-03-16");
  });

  it("throws when safety limit is reached (all days closed)", async () => {
    // With empty business hours, every day is "closed" via getBusinessHoursForDate
    const emptyHours: BusinessHours = {};
    const { admin } = createMockAdminForPassEndDate();

    await expect(
      calculatePassEndDate(admin, SPACE_ID, "2026-03-11", 5, emptyHours, TZ),
    ).rejects.toThrow("Could not find enough open days for pass duration");
  });

  it("always skips weekends even when business hours include them", async () => {
    const { admin } = createMockAdminForPassEndDate();
    // Start Fri 2026-03-13, need 3 days
    // Day 1: Fri 03-13, skip Sat/Sun (hard-coded weekend skip), Day 2: Mon 03-16, Day 3: Tue 03-17
    const result = await calculatePassEndDate(admin, SPACE_ID, "2026-03-13", 3, FULL_WEEK_HOURS, TZ);
    expect(result).toBe("2026-03-17");
  });

  it("handles a 10-day pass spanning multiple weeks", async () => {
    const { admin } = createMockAdminForPassEndDate();
    // Start Mon 2026-03-09, need 10 weekdays
    // Week 1: Mon-Fri (5 days, 03-09 to 03-13)
    // Week 2: Mon-Fri (5 days, 03-16 to 03-20)
    const result = await calculatePassEndDate(admin, SPACE_ID, "2026-03-09", 10, WEEKDAY_HOURS, TZ);
    expect(result).toBe("2026-03-20");
  });

  it("handles null closures response gracefully", async () => {
    // Simulate Supabase returning null data
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const admin = { from: vi.fn().mockReturnValue(chain) } as unknown as Parameters<typeof calculatePassEndDate>[0];

    const result = await calculatePassEndDate(admin, SPACE_ID, "2026-03-11", 2, WEEKDAY_HOURS, TZ);
    // Should still work without closures — Wed + Thu
    expect(result).toBe("2026-03-12");
  });
});
