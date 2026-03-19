const PLATFORM_DOMAIN = (
  process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "localhost:3000"
)
  .split(":")[0]!;

function getCookieDomain(hostname: string): string | undefined {
  const host = hostname.split(":")[0]!;

  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost")) {
    return undefined;
  }

  if (host === PLATFORM_DOMAIN || host.endsWith(`.${PLATFORM_DOMAIN}`)) {
    return `.${PLATFORM_DOMAIN}`;
  }

  return undefined;
}

export function getCookieOptions(hostname: string) {
  const domain = getCookieDomain(hostname);
  return {
    ...(domain ? { domain } : {}),
    path: "/",
  } as const;
}
