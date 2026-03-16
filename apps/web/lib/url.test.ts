import { describe, expect, it } from "vitest";
import {
  buildSpaceUrl,
  buildSpaceUrlClient,
  buildSpaceUrlFromHeaders,
  getOrigin,
  getProto,
  isPlatformHost,
} from "./url";

/** Simple mock for the Headers-like object used by Next.js server functions. */
function mockHeaders(map: Record<string, string>) {
  return { get: (name: string) => map[name] ?? null };
}

// ── getProto ──────────────────────────────────────────────────────────────

describe("getProto", () => {
  it("returns x-forwarded-proto when present", () => {
    const h = mockHeaders({ "x-forwarded-proto": "https" });
    expect(getProto(h)).toBe("https");
  });

  it("falls back to http when header is missing", () => {
    const h = mockHeaders({});
    expect(getProto(h)).toBe("http");
  });
});

// ── getOrigin ─────────────────────────────────────────────────────────────

describe("getOrigin", () => {
  it("uses x-forwarded-host and x-forwarded-proto when both are present", () => {
    const h = mockHeaders({
      "x-forwarded-proto": "https",
      "x-forwarded-host": "app.cowork.io",
    });
    expect(getOrigin(h)).toBe("https://app.cowork.io");
  });

  it("falls back to host header when x-forwarded-host is missing", () => {
    const h = mockHeaders({ host: "staging.example.com" });
    expect(getOrigin(h)).toBe("http://staging.example.com");
  });

  it("falls back to localhost:3000 when no host headers are present", () => {
    const h = mockHeaders({});
    expect(getOrigin(h)).toBe("http://localhost:3000");
  });

  it("prefers x-forwarded-host over host", () => {
    const h = mockHeaders({
      "x-forwarded-host": "prod.cowork.io",
      host: "internal-lb.cluster",
    });
    expect(getOrigin(h)).toBe("http://prod.cowork.io");
  });
});

// ── isPlatformHost ────────────────────────────────────────────────────────

describe("isPlatformHost", () => {
  it("matches the exact platform domain (localhost)", () => {
    expect(isPlatformHost("localhost")).toBe(true);
  });

  it("matches with port (localhost:3000)", () => {
    expect(isPlatformHost("localhost:3000")).toBe(true);
  });

  it("matches a subdomain of the platform domain", () => {
    expect(isPlatformHost("acme.localhost")).toBe(true);
    expect(isPlatformHost("acme.localhost:3000")).toBe(true);
  });

  it("matches deeply nested subdomains", () => {
    expect(isPlatformHost("deep.sub.localhost")).toBe(true);
  });

  it("rejects a completely different host", () => {
    expect(isPlatformHost("other.com")).toBe(false);
  });

  it("rejects a host that contains the domain as a substring but is not a subdomain", () => {
    // "notlocalhost" ends with "localhost" as a string but is not a subdomain
    expect(isPlatformHost("notlocalhost")).toBe(false);
  });
});

// ── buildSpaceUrl ─────────────────────────────────────────────────────────

describe("buildSpaceUrl", () => {
  it("builds a subdomain URL for a platform host", () => {
    const result = buildSpaceUrl("acme", "/dashboard", "http://localhost:3000");
    expect(result).toBe("http://acme.localhost:3000/dashboard");
  });

  it("builds a subdomain URL when the origin already has a subdomain", () => {
    const result = buildSpaceUrl("beta", "/settings", "http://app.localhost:3000");
    expect(result).toBe("http://beta.localhost:3000/settings");
  });

  it("appends a query param for a non-platform (preview) host", () => {
    const result = buildSpaceUrl(
      "acme",
      "/dashboard",
      "https://preview-abc123.vercel.app",
    );
    expect(result).toBe(
      "https://preview-abc123.vercel.app/dashboard?space=acme",
    );
  });

  it("uses & separator when path already contains query params", () => {
    const result = buildSpaceUrl(
      "acme",
      "/checkout?session_id={CHECKOUT_SESSION_ID}",
      "https://preview.vercel.app",
    );
    expect(result).toBe(
      "https://preview.vercel.app/checkout?session_id={CHECKOUT_SESSION_ID}&space=acme",
    );
  });

  it("handles root path on platform host", () => {
    const result = buildSpaceUrl("acme", "/", "http://localhost:3000");
    expect(result).toBe("http://acme.localhost:3000/");
  });

  it("handles root path on preview host", () => {
    const result = buildSpaceUrl("acme", "/", "https://deploy.vercel.app");
    expect(result).toBe("https://deploy.vercel.app/?space=acme");
  });
});

// ── buildSpaceUrlFromHeaders ──────────────────────────────────────────────

describe("buildSpaceUrlFromHeaders", () => {
  it("delegates to buildSpaceUrl using the derived origin from headers", () => {
    const h = mockHeaders({
      "x-forwarded-proto": "https",
      "x-forwarded-host": "localhost:3000",
    });
    const result = buildSpaceUrlFromHeaders("acme", "/book", h);
    expect(result).toBe("https://acme.localhost:3000/book");
  });

  it("falls back to http://localhost:3000 when headers are empty", () => {
    const h = mockHeaders({});
    const result = buildSpaceUrlFromHeaders("acme", "/book", h);
    expect(result).toBe("http://acme.localhost:3000/book");
  });

  it("appends query param when headers indicate a preview host", () => {
    const h = mockHeaders({
      "x-forwarded-proto": "https",
      "x-forwarded-host": "preview-deploy.vercel.app",
    });
    const result = buildSpaceUrlFromHeaders("acme", "/book", h);
    expect(result).toBe("https://preview-deploy.vercel.app/book?space=acme");
  });
});

// ── buildSpaceUrlClient ───────────────────────────────────────────────────

describe("buildSpaceUrlClient", () => {
  it("uses window.location.origin to build the URL", () => {
    // jsdom sets window.location.origin to "http://localhost"
    // "localhost" is the platform domain, so it should produce a subdomain URL
    const result = buildSpaceUrlClient("acme", "/dashboard");
    expect(result).toBe("http://acme.localhost:3000/dashboard");
  });
});
