import { describe, expect, it } from "vitest";
import { isReservedSlug, RESERVED_SLUGS } from "./reserved-slugs";

describe("RESERVED_SLUGS", () => {
  it("contains expected platform infrastructure slugs", () => {
    expect(RESERVED_SLUGS).toContain("admin");
    expect(RESERVED_SLUGS).toContain("api");
    expect(RESERVED_SLUGS).toContain("app");
    expect(RESERVED_SLUGS).toContain("www");
  });

  it("contains auth-related slugs", () => {
    expect(RESERVED_SLUGS).toContain("auth");
    expect(RESERVED_SLUGS).toContain("login");
    expect(RESERVED_SLUGS).toContain("signup");
    expect(RESERVED_SLUGS).toContain("sso");
  });

  it("has no duplicates", () => {
    const unique = new Set(RESERVED_SLUGS);
    expect(unique.size).toBe(RESERVED_SLUGS.length);
  });
});

describe("isReservedSlug", () => {
  it("returns true for reserved platform slugs", () => {
    expect(isReservedSlug("admin")).toBe(true);
    expect(isReservedSlug("api")).toBe(true);
    expect(isReservedSlug("www")).toBe(true);
    expect(isReservedSlug("auth")).toBe(true);
  });

  it("returns true for dev and testing slugs", () => {
    expect(isReservedSlug("dev")).toBe(true);
    expect(isReservedSlug("test")).toBe(true);
    expect(isReservedSlug("staging")).toBe(true);
    expect(isReservedSlug("preview")).toBe(true);
    expect(isReservedSlug("demo")).toBe(true);
    expect(isReservedSlug("sandbox")).toBe(true);
  });

  it("returns true for platform-specific slugs", () => {
    expect(isReservedSlug("rogueops")).toBe(true);
    expect(isReservedSlug("platform")).toBe(true);
    expect(isReservedSlug("internal")).toBe(true);
  });

  it("returns false for valid tenant slugs", () => {
    expect(isReservedSlug("acme-coworking")).toBe(false);
    expect(isReservedSlug("urban-hive")).toBe(false);
    expect(isReservedSlug("workspace-42")).toBe(false);
  });

  it("is case-sensitive (slugs should be lowercase)", () => {
    expect(isReservedSlug("Admin")).toBe(false);
    expect(isReservedSlug("API")).toBe(false);
    expect(isReservedSlug("WWW")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isReservedSlug("")).toBe(false);
  });

  it("returns false for partial matches", () => {
    expect(isReservedSlug("admin-panel")).toBe(false);
    expect(isReservedSlug("myapi")).toBe(false);
    expect(isReservedSlug("the-blog")).toBe(false);
  });
});
