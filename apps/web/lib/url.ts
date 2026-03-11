const PLATFORM_DOMAIN =
  process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "localhost:3000";

/** Derive the request origin from forwarded headers (Vercel/proxy) with localhost fallback. */
export function getOrigin(h: { get(name: string): string | null }): string {
  const proto = getProto(h);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

/** Get the request protocol from forwarded headers. */
export function getProto(h: { get(name: string): string | null }): string {
  return h.get("x-forwarded-proto") ?? "http";
}

/** Check whether a hostname belongs to the platform domain (supports subdomains). */
export function isPlatformHost(hostname: string): boolean {
  const host = hostname.split(":")[0]!;
  const domain = PLATFORM_DOMAIN.split(":")[0]!;
  return host === domain || host.endsWith(`.${domain}`);
}

/**
 * Build a URL for a space.
 * - On production / platform domain → subdomain: `<slug>.<domain>/<path>`
 * - On preview deployments → query param: `<currentOrigin>/<path>?space=<slug>`
 */
export function buildSpaceUrl(
  slug: string,
  path: string,
  currentOrigin: string,
): string {
  const url = new URL(currentOrigin);
  const host = url.hostname;

  if (isPlatformHost(host)) {
    return `${url.protocol}//${slug}.${PLATFORM_DOMAIN}${path}`;
  }

  // Preview deployment: append ?space= (use string concat to preserve template vars like {CHECKOUT_SESSION_ID})
  const base = `${url.origin}${path}`;
  const separator = path.includes("?") ? "&" : "?";
  return `${base}${separator}space=${slug}`;
}

/**
 * Build a space URL from server-side headers.
 */
export function buildSpaceUrlFromHeaders(
  slug: string,
  path: string,
  h: { get(name: string): string | null },
): string {
  return buildSpaceUrl(slug, path, getOrigin(h));
}

/**
 * Client-side: build a space URL using window.location.
 */
export function buildSpaceUrlClient(slug: string, path: string): string {
  return buildSpaceUrl(slug, path, window.location.origin);
}
