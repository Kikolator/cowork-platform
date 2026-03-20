import { describe, expect, it, vi } from "vitest";
import {
  getDeskAvailabilityRange,
  getRoomSlots,
  getClosures,
} from "./availability";

// ── Supabase mock helpers ─────────────────────────────────────────────────

/** Build a chainable Supabase query builder mock */
function mockQueryBuilder(data: unknown, error: unknown = null) {
  const builder: Record<string, unknown> = {};
  const methods = ["from", "select", "eq", "gte", "lte", "in", "limit", "single"];
  for (const m of methods) {
    builder[m] = vi.fn(() => builder);
  }
  // Terminal: resolves with { data, error }
  builder.then = (resolve: (val: unknown) => void) =>
    resolve({ data, error });
  // Make it thenable for await
  Object.defineProperty(builder, Symbol.toStringTag, { value: "Promise" });
  return builder;
}

function createMockSupabase(overrides: {
  closures?: { date: string }[];
  space?: { timezone: string; business_hours: unknown } | null;
  rpcDeskResults?: { total_desks: number; booked_desks: number; available_desks: number }[];
  userBookings?: { start_time: string; resource: { resource_type: { slug: string } } }[];
  rpcRoomResults?: { slot_start: string; slot_end: string; is_available: boolean }[] | null;
  rpcError?: unknown;
}) {
  const closuresBuilder = mockQueryBuilder(overrides.closures ?? []);
  const spaceBuilder = mockQueryBuilder(overrides.space ?? { timezone: "Europe/Madrid", business_hours: {} });
  const userBookingsBuilder = mockQueryBuilder(overrides.userBookings ?? []);

  const rpcFn = vi.fn((funcName: string) => {
    if (funcName === "get_desk_availability") {
      return Promise.resolve({ data: overrides.rpcDeskResults ?? [{ total_desks: 10, booked_desks: 2, available_desks: 8 }] });
    }
    if (funcName === "get_room_availability") {
      if (overrides.rpcError) {
        return Promise.resolve({ data: null, error: overrides.rpcError });
      }
      return Promise.resolve({ data: overrides.rpcRoomResults ?? [], error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });

  let fromCallCount = 0;
  const fromFn = vi.fn((table: string) => {
    if (table === "space_closures") return closuresBuilder;
    if (table === "spaces") return spaceBuilder;
    if (table === "bookings") return userBookingsBuilder;
    fromCallCount++;
    return mockQueryBuilder(null);
  });

  return { from: fromFn, rpc: rpcFn } as unknown as Parameters<typeof getDeskAvailabilityRange>[0];
}

// ── getDeskAvailabilityRange ──────────────────────────────────────────────

describe("getDeskAvailabilityRange", () => {
  const SPACE_ID = "space-abc-123";
  const USER_ID = "user-def-456";

  it("returns availability for each date in the range", async () => {
    const supabase = createMockSupabase({
      closures: [],
      space: { timezone: "Europe/Madrid", business_hours: {} },
      rpcDeskResults: [{ total_desks: 10, booked_desks: 3, available_desks: 7 }],
      userBookings: [],
    });

    const result = await getDeskAvailabilityRange(
      supabase,
      SPACE_ID,
      USER_ID,
      "2026-03-11",
      "2026-03-13",
    );

    expect(Object.keys(result)).toEqual(["2026-03-11", "2026-03-12", "2026-03-13"]);
    expect(result["2026-03-11"]).toEqual({
      available: 7,
      total: 10,
      closed: false,
      userBooked: false,
    });
  });

  it("marks closed dates with zero availability", async () => {
    const supabase = createMockSupabase({
      closures: [{ date: "2026-03-12" }],
      rpcDeskResults: [{ total_desks: 10, booked_desks: 0, available_desks: 10 }],
      userBookings: [],
    });

    const result = await getDeskAvailabilityRange(
      supabase,
      SPACE_ID,
      USER_ID,
      "2026-03-11",
      "2026-03-13",
    );

    expect(result["2026-03-12"].closed).toBe(true);
    expect(result["2026-03-12"].available).toBe(0);
    // Non-closed dates should still have availability
    expect(result["2026-03-11"].closed).toBe(false);
  });

  it("marks dates where user already has a desk booking", async () => {
    const supabase = createMockSupabase({
      closures: [],
      rpcDeskResults: [{ total_desks: 10, booked_desks: 1, available_desks: 9 }],
      userBookings: [
        {
          start_time: "2026-03-11T08:00:00.000Z",
          resource: { resource_type: { slug: "desk" } },
        },
      ],
    });

    const result = await getDeskAvailabilityRange(
      supabase,
      SPACE_ID,
      USER_ID,
      "2026-03-11",
      "2026-03-12",
    );

    expect(result["2026-03-11"].userBooked).toBe(true);
    expect(result["2026-03-12"].userBooked).toBe(false);
  });

  it("ignores non-desk bookings when determining user booked status", async () => {
    const supabase = createMockSupabase({
      closures: [],
      rpcDeskResults: [{ total_desks: 10, booked_desks: 0, available_desks: 10 }],
      userBookings: [
        {
          start_time: "2026-03-11T08:00:00.000Z",
          resource: { resource_type: { slug: "meeting_room" } },
        },
      ],
    });

    const result = await getDeskAvailabilityRange(
      supabase,
      SPACE_ID,
      USER_ID,
      "2026-03-11",
      "2026-03-11",
    );

    expect(result["2026-03-11"].userBooked).toBe(false);
  });

  it("handles null RPC results gracefully", async () => {
    const supabase = createMockSupabase({
      closures: [],
      rpcDeskResults: [],
      userBookings: [],
    });

    // Override rpc to return null data
    (supabase as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc.mockImplementation(
      () => Promise.resolve({ data: null }),
    );

    const result = await getDeskAvailabilityRange(
      supabase,
      SPACE_ID,
      USER_ID,
      "2026-03-11",
      "2026-03-11",
    );

    expect(result["2026-03-11"]).toEqual({
      available: 0,
      total: 0,
      closed: false,
      userBooked: false,
    });
  });
});

// ── getRoomSlots ──────────────────────────────────────────────────────────

describe("getRoomSlots", () => {
  const SPACE_ID = "space-abc-123";
  const RESOURCE_ID = "room-xyz-789";

  it("returns mapped time slots from RPC response", async () => {
    const supabase = createMockSupabase({
      rpcRoomResults: [
        { slot_start: "2026-03-11T08:00:00Z", slot_end: "2026-03-11T09:00:00Z", is_available: true },
        { slot_start: "2026-03-11T09:00:00Z", slot_end: "2026-03-11T10:00:00Z", is_available: false },
        { slot_start: "2026-03-11T10:00:00Z", slot_end: "2026-03-11T11:00:00Z", is_available: true },
      ],
    });

    const slots = await getRoomSlots(supabase, SPACE_ID, RESOURCE_ID, "2026-03-11");

    expect(slots).toHaveLength(3);
    expect(slots[0]).toEqual({
      slotStart: "2026-03-11T08:00:00Z",
      slotEnd: "2026-03-11T09:00:00Z",
      isAvailable: true,
    });
    expect(slots[1].isAvailable).toBe(false);
    expect(slots[2].isAvailable).toBe(true);
  });

  it("returns empty array when RPC returns an error", async () => {
    const supabase = createMockSupabase({
      rpcError: { message: "Function not found" },
    });

    const slots = await getRoomSlots(supabase, SPACE_ID, RESOURCE_ID, "2026-03-11");
    expect(slots).toEqual([]);
  });

  it("returns empty array when RPC returns null data", async () => {
    const supabase = createMockSupabase({
      rpcRoomResults: null,
    });

    const slots = await getRoomSlots(supabase, SPACE_ID, RESOURCE_ID, "2026-03-11");
    expect(slots).toEqual([]);
  });
});

// ── getClosures ──────────────────────────────────────────────────────────

describe("getClosures", () => {
  const SPACE_ID = "space-abc-123";

  it("returns array of closure date strings", async () => {
    const supabase = createMockSupabase({
      closures: [{ date: "2026-03-15" }, { date: "2026-03-20" }],
    });

    const closures = await getClosures(supabase, SPACE_ID, "2026-03-01", "2026-03-31");
    expect(closures).toEqual(["2026-03-15", "2026-03-20"]);
  });

  it("returns empty array when there are no closures", async () => {
    const supabase = createMockSupabase({ closures: [] });

    const closures = await getClosures(supabase, SPACE_ID, "2026-03-01", "2026-03-31");
    expect(closures).toEqual([]);
  });

  it("returns empty array when query returns null", async () => {
    const supabase = createMockSupabase({});
    // Override from to return null data
    const builder = mockQueryBuilder(null);
    (supabase as unknown as { from: ReturnType<typeof vi.fn> }).from.mockReturnValue(builder);

    const closures = await getClosures(supabase, SPACE_ID, "2026-03-01", "2026-03-31");
    expect(closures).toEqual([]);
  });
});
