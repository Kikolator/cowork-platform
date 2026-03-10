import { createClient } from "@supabase/supabase-js";
import type { Database } from "@cowork/db";
import type { SpaceContext } from "./types";

const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "localhost:3000";

const cache = new Map<string, { space: SpaceContext | null; expiresAt: number }>();
const TTL_MS = 60_000;

function getSupabase() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUB_KEY!
  );
}

export async function resolveSpaceFromHostname(
  hostname: string
): Promise<SpaceContext | null> {
  const cached = cache.get(hostname);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.space;
  }

  const space = await lookupSpace(hostname);
  cache.set(hostname, { space, expiresAt: Date.now() + TTL_MS });
  return space;
}

async function lookupSpace(hostname: string): Promise<SpaceContext | null> {
  const supabase = getSupabase();

  // Strip port for domain matching
  const hostnameBase = hostname.split(":")[0]!;
  const platformDomainBase = PLATFORM_DOMAIN.split(":")[0]!;

  if (hostnameBase === platformDomainBase) {
    return null; // bare platform domain, no space
  }

  let slug: string | null = null;
  let isCustomDomain = false;

  if (hostnameBase.endsWith(`.${platformDomainBase}`)) {
    slug = hostnameBase.replace(`.${platformDomainBase}`, "");
  } else {
    isCustomDomain = true;
  }

  const base = supabase
    .from("spaces")
    .select("id, tenant_id, slug, name, logo_url, primary_color, accent_color")
    .eq("active", true);

  const query = isCustomDomain
    ? base.eq("custom_domain", hostname)
    : slug
      ? base.eq("slug", slug)
      : null;

  if (!query) return null;

  const { data, error } = await query.limit(1).single();
  if (error || !data) return null;

  return {
    id: data.id,
    tenantId: data.tenant_id,
    slug: data.slug,
    name: data.name,
    logoUrl: data.logo_url,
    primaryColor: data.primary_color ?? "#000000",
    accentColor: data.accent_color ?? "#3b82f6",
  };
}
