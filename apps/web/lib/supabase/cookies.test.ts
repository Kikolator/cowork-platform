import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * PLATFORM_DOMAIN is computed at module load time from
 * process.env.NEXT_PUBLIC_PLATFORM_DOMAIN, so we must set the env var
 * BEFORE importing the module. We use vi.resetModules() + dynamic import()
 * to re-evaluate the module with different env values per test group.
 */

async function importCookies() {
  const mod = await import("./cookies");
  return mod;
}

describe("getCookieOptions", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('when PLATFORM_DOMAIN is "example.com"', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_PLATFORM_DOMAIN = "example.com";
    });

    afterEach(() => {
      delete process.env.NEXT_PUBLIC_PLATFORM_DOMAIN;
    });

    it("returns no domain for localhost", async () => {
      const { getCookieOptions } = await importCookies();
      expect(getCookieOptions("localhost")).toEqual({ path: "/" });
    });

    it("returns no domain for 127.0.0.1", async () => {
      const { getCookieOptions } = await importCookies();
      expect(getCookieOptions("127.0.0.1")).toEqual({ path: "/" });
    });

    it("returns platform domain cookie for exact platform domain", async () => {
      const { getCookieOptions } = await importCookies();
      expect(getCookieOptions("example.com")).toEqual({
        domain: ".example.com",
        path: "/",
      });
    });

    it("returns platform domain cookie for a subdomain of the platform", async () => {
      const { getCookieOptions } = await importCookies();
      expect(getCookieOptions("space.example.com")).toEqual({
        domain: ".example.com",
        path: "/",
      });
    });

    it("returns no domain for a custom domain unrelated to the platform", async () => {
      const { getCookieOptions } = await importCookies();
      expect(getCookieOptions("custom-domain.org")).toEqual({ path: "/" });
    });

    it("strips port from hostname before matching", async () => {
      const { getCookieOptions } = await importCookies();
      expect(getCookieOptions("example.com:3000")).toEqual({
        domain: ".example.com",
        path: "/",
      });
    });

    it("returns platform domain cookie for deeply nested subdomain", async () => {
      const { getCookieOptions } = await importCookies();
      expect(getCookieOptions("deep.sub.example.com")).toEqual({
        domain: ".example.com",
        path: "/",
      });
    });

    it("does not match a host that contains the domain as a substring", async () => {
      const { getCookieOptions } = await importCookies();
      // "notexample.com" ends with "example.com" as substring but is not a subdomain
      expect(getCookieOptions("notexample.com")).toEqual({ path: "/" });
    });

    it("returns no domain for .localhost subdomain", async () => {
      const { getCookieOptions } = await importCookies();
      expect(getCookieOptions("space.localhost")).toEqual({ path: "/" });
    });

    it("strips port from subdomain hostname", async () => {
      const { getCookieOptions } = await importCookies();
      expect(getCookieOptions("space.example.com:8080")).toEqual({
        domain: ".example.com",
        path: "/",
      });
    });

    it("always includes path: '/'", async () => {
      const { getCookieOptions } = await importCookies();
      expect(getCookieOptions("localhost")).toHaveProperty("path", "/");
      expect(getCookieOptions("example.com")).toHaveProperty("path", "/");
      expect(getCookieOptions("other.org")).toHaveProperty("path", "/");
    });
  });

  describe("when NEXT_PUBLIC_PLATFORM_DOMAIN is not set (defaults to localhost)", () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_PLATFORM_DOMAIN;
    });

    it("returns no domain for localhost", async () => {
      const { getCookieOptions } = await importCookies();
      expect(getCookieOptions("localhost")).toEqual({ path: "/" });
    });

    it("returns no domain for localhost with port", async () => {
      const { getCookieOptions } = await importCookies();
      expect(getCookieOptions("localhost:3000")).toEqual({ path: "/" });
    });

    it("returns no domain for 127.0.0.1 when platform defaults to localhost", async () => {
      const { getCookieOptions } = await importCookies();
      expect(getCookieOptions("127.0.0.1")).toEqual({ path: "/" });
    });
  });
});
