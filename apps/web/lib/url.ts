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
