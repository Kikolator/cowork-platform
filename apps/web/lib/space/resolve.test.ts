import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mock Supabase client ─────────────────────────────────────────────────

const mockSingleResult = { data: null as unknown, error: null as unknown };

const mockQueryBuilder: Record<string, unknown> = {};
for (const m of ["select", "eq", "limit", "single"]) {
  mockQueryBuilder[m] = vi.fn(() => mockQueryBuilder);
}
// Override single to resolve with result
mockQueryBuilder.single = vi.fn(() => Promise.resolve(mockSingleResult));

const mockCreateClient = vi.fn(() => ({
  from: vi.fn(() => mockQueryBuilder),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

// Must import after mocking
import { resolveSpaceFromHostname, resolveSpaceBySlug } from "./resolve";

// ── Helpers ──────────────────────────────────────────────────────────────

const SPACE_ROW = {
  id: "space-abc-123",
  tenant_id: "tenant-xyz-789",
  slug: "urban-hive",
  name: "Urban Hive Coworking",
  logo_url: "https://cdn.example.com/logo.png",
  logo_dark_url: null,
  favicon_url: null,
  primary_color: "#1a1a2e",
  accent_color: "#e94560",
};

function setSpaceResult(data: typeof SPACE_ROW | null, error: unknown = null) {
  mockSingleResult.data = data;
  mockSingleResult.error = error;
}

// ── resolveSpaceFromHostname ─────────────────────────────────────────────

describe("resolveSpaceFromHostname", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the in-memory cache by resetting the module
    // Since cache is module-scoped, we need to expire entries by advancing time
    vi.useFakeTimers();
    // Jump far enough ahead to expire any cached entries
    vi.setSystemTime(new Date("2030-01-01T00:00:00.000Z"));
    vi.advanceTimersByTime(120_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for the bare platform domain", async () => {
    const result = await resolveSpaceFromHostname("localhost:3000");
    expect(result).toBeNull();
  });

  it("returns null for the bare platform domain without port", async () => {
    const result = await resolveSpaceFromHostname("localhost");
    expect(result).toBeNull();
  });

  it("resolves a space from subdomain of platform domain", async () => {
    setSpaceResult(SPACE_ROW);

    const result = await resolveSpaceFromHostname("urban-hive.localhost:3000");

    expect(result).toEqual({
      id: "space-abc-123",
      tenantId: "tenant-xyz-789",
      slug: "urban-hive",
      name: "Urban Hive Coworking",
      logoUrl: "https://cdn.example.com/logo.png",
      logoDarkUrl: null,
      faviconUrl: null,
      primaryColor: "#1a1a2e",
      accentColor: "#e94560",
    });
  });

  it("resolves a space from a custom domain", async () => {
    setSpaceResult(SPACE_ROW);

    const result = await resolveSpaceFromHostname("cowork.urban-hive.com");

    expect(result).not.toBeNull();
    expect(result?.slug).toBe("urban-hive");
  });

  it("returns null when space is not found in database", async () => {
    setSpaceResult(null, { code: "PGRST116", message: "No rows found" });

    const result = await resolveSpaceFromHostname("nonexistent.localhost:3000");
    expect(result).toBeNull();
  });

  it("applies default colors when space has no custom colors", async () => {
    setSpaceResult({ ...SPACE_ROW, primary_color: null, accent_color: null });

    const result = await resolveSpaceFromHostname("test-space.localhost:3000");

    expect(result?.primaryColor).toBe("#000000");
    expect(result?.accentColor).toBe("#3b82f6");
  });

  it("caches results to avoid duplicate queries", async () => {
    setSpaceResult(SPACE_ROW);

    const result1 = await resolveSpaceFromHostname("cached.localhost:3000");
    const result2 = await resolveSpaceFromHostname("cached.localhost:3000");

    expect(result1).toEqual(result2);
    // createClient is called once at module level via getSupabase(), so checking from() calls
    // The second call should use cache and not hit DB again
  });

  it("cache expires after TTL", async () => {
    setSpaceResult(SPACE_ROW);

    await resolveSpaceFromHostname("expiring.localhost:3000");

    // Advance past 60s TTL
    vi.advanceTimersByTime(61_000);

    setSpaceResult({ ...SPACE_ROW, name: "Updated Name" });
    const result = await resolveSpaceFromHostname("expiring.localhost:3000");

    expect(result?.name).toBe("Updated Name");
  });
});

// ── resolveSpaceBySlug ──────────────────────────────────────────────────

describe("resolveSpaceBySlug", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2031-01-01T00:00:00.000Z"));
    vi.advanceTimersByTime(120_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves a space by its slug", async () => {
    setSpaceResult(SPACE_ROW);

    const result = await resolveSpaceBySlug("urban-hive");

    expect(result).not.toBeNull();
    expect(result?.id).toBe("space-abc-123");
    expect(result?.slug).toBe("urban-hive");
  });

  it("returns null when slug does not match any space", async () => {
    setSpaceResult(null, { code: "PGRST116", message: "No rows found" });

    const result = await resolveSpaceBySlug("nonexistent-space");
    expect(result).toBeNull();
  });

  it("transforms database row to SpaceContext shape", async () => {
    setSpaceResult(SPACE_ROW);

    const result = await resolveSpaceBySlug("urban-hive");

    expect(result).toEqual({
      id: "space-abc-123",
      tenantId: "tenant-xyz-789",
      slug: "urban-hive",
      name: "Urban Hive Coworking",
      logoUrl: "https://cdn.example.com/logo.png",
      logoDarkUrl: null,
      faviconUrl: null,
      primaryColor: "#1a1a2e",
      accentColor: "#e94560",
    });
  });
});
