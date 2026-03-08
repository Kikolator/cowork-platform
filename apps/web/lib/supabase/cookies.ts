const platformDomain =
  process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "localhost:3000";

// Extract base domain without port — e.g. "localhost" from "localhost:3000"
const baseDomain = platformDomain.split(":")[0]!;

// Chrome rejects ".localhost" as a cookie domain (treats localhost as a TLD).
// Only set domain for real domains so cookies are shared across subdomains.
const isLocalhost = baseDomain === "localhost";
export const cookieDomain = isLocalhost ? undefined : `.${baseDomain}`;

export const cookieOptions = {
  ...(cookieDomain ? { domain: cookieDomain } : {}),
  path: "/",
} as const;
