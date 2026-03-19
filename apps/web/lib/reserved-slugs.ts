/**
 * Subdomains reserved for platform infrastructure.
 * Tenants cannot use these as space slugs.
 */
export const RESERVED_SLUGS = [
  // Platform infrastructure
  "admin",
  "api",
  "app",
  "www",
  "cdn",
  "static",
  "assets",
  "media",
  // Auth & access
  "auth",
  "login",
  "signup",
  "register",
  "sso",
  "oauth",
  // Platform routes
  "onboard",
  "dashboard",
  "billing",
  "settings",
  "support",
  "help",
  "docs",
  "status",
  // Dev & testing
  "dev",
  "test",
  "staging",
  "preview",
  "demo",
  "sandbox",
  // Email & services
  "mail",
  "email",
  "smtp",
  "ftp",
  "ns1",
  "ns2",
  // Common abuse targets
  "blog",
  "shop",
  "store",
  "pay",
  "payments",
  "webhooks",
  "webhook",
  "internal",
  "system",
  "platform",
  "rogueops",
] as const;

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug as (typeof RESERVED_SLUGS)[number]);
}
