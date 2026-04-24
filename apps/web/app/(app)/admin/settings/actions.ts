"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createLogger } from "@cowork/shared";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSpaceUrlFromHeaders } from "@/lib/url";
import { brandingSchema, operationsSchema, fiscalSchema } from "./schemas";
import { isReservedSlug } from "@/lib/reserved-slugs";
import {
  getOrCreateConnectAccount,
  createAccountLink,
  isAccountOnboarded,
} from "@/lib/stripe/connect";

function extractStoragePath(publicUrl: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}

async function getSpaceId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const spaceId = user.app_metadata?.space_id as string | undefined;
  if (!spaceId) throw new Error("No space context");
  return { supabase, user, spaceId };
}

async function getOwnerContext() {
  const ctx = await getSpaceId();
  const role = ctx.user.app_metadata?.space_role as string | undefined;
  if (role !== "owner") {
    throw new Error("Only the space owner can manage Stripe Connect");
  }
  const tenantId = ctx.user.app_metadata?.tenant_id as string | undefined;
  if (!tenantId) throw new Error("No tenant context");
  return { ...ctx, tenantId };
}

export async function updateSpaceBranding(input: unknown) {
  const parsed = brandingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, spaceId } = await getSpaceId();

  // Check slug uniqueness if changed
  const { data: current } = await supabase
    .from("spaces")
    .select("slug, tenant_id, logo_url, logo_dark_url, favicon_url")
    .eq("id", spaceId)
    .single();

  if (current && parsed.data.slug !== current.slug) {
    if (isReservedSlug(parsed.data.slug)) {
      return { success: false as const, error: "This slug is reserved and cannot be used" };
    }

    const { data: existing } = await supabase
      .from("spaces")
      .select("id")
      .eq("tenant_id", current.tenant_id)
      .eq("slug", parsed.data.slug)
      .neq("id", spaceId)
      .maybeSingle();

    if (existing) {
      return { success: false as const, error: "A space with this slug already exists" };
    }
  }

  const d = parsed.data;
  const { error } = await supabase
    .from("spaces")
    .update({
      name: d.name,
      slug: d.slug,
      logo_url: d.logoUrl || null,
      logo_dark_url: d.logoDarkUrl || null,
      favicon_url: d.faviconUrl || null,
      primary_color: d.primaryColor,
      accent_color: d.accentColor,
      // header_logo_mode added by migration; not yet in generated types
      header_logo_mode: d.headerLogoMode,
    } as Record<string, unknown>)
    .eq("id", spaceId);

  if (error) return { success: false as const, error: error.message };

  // Clean up old storage files when logo/favicon URLs change (best-effort)
  if (current) {
    const filesToRemove: string[] = [];

    const oldLogo = current.logo_url;
    const newLogo = parsed.data.logoUrl || null;
    if (oldLogo && oldLogo !== newLogo) {
      const path = extractStoragePath(oldLogo, "space-assets");
      if (path) filesToRemove.push(path);
    }

    const oldLogoDark = current.logo_dark_url;
    const newLogoDark = parsed.data.logoDarkUrl || null;
    if (oldLogoDark && oldLogoDark !== newLogoDark) {
      const path = extractStoragePath(oldLogoDark, "space-assets");
      if (path) filesToRemove.push(path);
    }

    const oldFavicon = current.favicon_url;
    const newFavicon = parsed.data.faviconUrl || null;
    if (oldFavicon && oldFavicon !== newFavicon) {
      const path = extractStoragePath(oldFavicon, "space-assets");
      if (path) filesToRemove.push(path);
    }

    if (filesToRemove.length > 0) {
      const { error: storageError } = await supabase.storage.from("space-assets").remove(filesToRemove);
      if (storageError) {
        createLogger({ component: "settings/actions", spaceId }).warn("Failed to clean up old storage files", {
          files: filesToRemove,
          error: storageError.message,
        });
      }
    }
  }

  revalidatePath("/admin/settings");
  return { success: true as const, slugChanged: current?.slug !== parsed.data.slug };
}

export async function updateSpaceOperations(input: unknown) {
  const parsed = operationsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, spaceId } = await getSpaceId();

  // Includes new columns (max_pass_desks, wifi_*, community_rules_text) from
  // pass_product_config migration — not yet in generated types, cast needed.
  const { error } = await supabase
    .from("spaces")
    .update({
      timezone: parsed.data.timezone,
      currency: parsed.data.currency,
      default_locale: parsed.data.defaultLocale,
      business_hours: parsed.data.businessHours,
      min_booking_minutes: parsed.data.minBookingMinutes,
      max_pass_desks: typeof parsed.data.maxPassDesks === "number" ? parsed.data.maxPassDesks : null,
      community_rules_text: parsed.data.communityRulesText || null,
    } as Record<string, unknown>)
    .eq("id", spaceId);

  if (error) return { success: false as const, error: error.message };

  revalidatePath("/admin/settings");
  return { success: true as const };
}

export async function updateSpaceFiscal(input: unknown) {
  const parsed = fiscalSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, spaceId } = await getSpaceId();

  const { error } = await supabase
    .from("spaces")
    .update({
      require_fiscal_id: parsed.data.requireFiscalId,
      supported_fiscal_id_types: parsed.data.supportedFiscalIdTypes,
    })
    .eq("id", spaceId);

  if (error) return { success: false as const, error: error.message };

  revalidatePath("/admin/settings");
  return { success: true as const };
}

const ALLOWED_FEATURE_KEYS = [
  "passes",
  "credits",
  "leads",
  "recurring_bookings",
  "guest_passes",
  "open_registration",
  "referrals",
] as const;

export async function updateFeatureFlag(key: string, value: boolean) {
  if (!ALLOWED_FEATURE_KEYS.includes(key as (typeof ALLOWED_FEATURE_KEYS)[number])) {
    return { success: false as const, error: "Invalid feature flag" };
  }

  const { supabase, spaceId } = await getSpaceId();

  // Read-modify-write to avoid losing other keys
  const { data: space } = await supabase
    .from("spaces")
    .select("features")
    .eq("id", spaceId)
    .single();

  const features: Record<string, unknown> = (space?.features as Record<string, unknown> | null) ?? {};
  features[key] = value;

  const { error } = await supabase
    .from("spaces")
    .update({ features: features as unknown as Record<string, never> })
    .eq("id", spaceId);

  if (error) return { success: false as const, error: error.message };

  revalidatePath("/admin/settings");
  return { success: true as const };
}

// --- Stripe Connect ---

export async function initiateStripeConnect(): Promise<
  | { success: true; url: string }
  | { success: false; error: string }
> {
  try {
    const { tenantId, user } = await getOwnerContext();
    const admin = createAdminClient();

    const { data: tenant } = await admin
      .from("tenants")
      .select("id, name, billing_email, stripe_account_id, spaces(slug)")
      .eq("id", tenantId)
      .single();

    if (!tenant) return { success: false, error: "Tenant not found" };

    const accountId = await getOrCreateConnectAccount(
      tenant.id,
      tenant.stripe_account_id,
      tenant.name,
      tenant.billing_email ?? user.email ?? "",
    );

    // Persist the account ID if it's new
    if (!tenant.stripe_account_id) {
      await admin
        .from("tenants")
        .update({ stripe_account_id: accountId })
        .eq("id", tenantId);
    }

    const h = await headers();
    const spaces = tenant.spaces as unknown as Array<{ slug: string }>;
    const slug = spaces?.[0]?.slug ?? "";

    const returnUrl = buildSpaceUrlFromHeaders(slug, "/admin/settings?stripe=complete", h);
    const refreshUrl = buildSpaceUrlFromHeaders(slug, "/admin/settings?stripe=refresh", h);

    const url = await createAccountLink(accountId, returnUrl, refreshUrl);

    revalidatePath("/admin/settings");
    return { success: true, url };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to initiate Stripe Connect",
    };
  }
}

export async function checkStripeStatus(): Promise<{
  connected: boolean;
  accountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  onboardingComplete?: boolean;
}> {
  try {
    const { supabase } = await getSpaceId();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const tenantId = user?.app_metadata?.tenant_id as string | undefined;
    if (!tenantId) return { connected: false };

    const admin = createAdminClient();
    const { data: tenant } = await admin
      .from("tenants")
      .select("stripe_account_id, stripe_onboarding_complete")
      .eq("id", tenantId)
      .single();

    if (!tenant?.stripe_account_id) return { connected: false };

    const status = await isAccountOnboarded(tenant.stripe_account_id);

    // Update onboarding status in database
    if (status.complete !== tenant.stripe_onboarding_complete) {
      await admin
        .from("tenants")
        .update({ stripe_onboarding_complete: status.complete })
        .eq("id", tenantId);
    }

    return {
      connected: true,
      accountId: tenant.stripe_account_id,
      chargesEnabled: status.chargesEnabled,
      payoutsEnabled: status.payoutsEnabled,
      detailsSubmitted: status.detailsSubmitted,
      onboardingComplete: status.complete,
    };
  } catch {
    return { connected: false };
  }
}

export async function disconnectStripe(): Promise<
  | { success: true }
  | { success: false; error: string }
> {
  try {
    const { tenantId } = await getOwnerContext();
    const admin = createAdminClient();

    await admin
      .from("tenants")
      .update({
        stripe_account_id: null,
        stripe_onboarding_complete: false,
      })
      .eq("id", tenantId);

    revalidatePath("/admin/settings");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to disconnect Stripe",
    };
  }
}

/* ── Closure management ──────────────────────────────────────── */

export async function addClosure(
  date: string,
  reason: string | null,
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    const { supabase, spaceId } = await getSpaceId();

    const { data, error } = await supabase
      .from("space_closures")
      .insert({ space_id: spaceId, date, reason, all_day: true })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "This date is already marked as closed" };
      }
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/settings");
    return { success: true, id: data.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to add closure",
    };
  }
}

export async function removeClosure(
  closureId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { supabase, spaceId } = await getSpaceId();

    const { error } = await supabase
      .from("space_closures")
      .delete()
      .eq("id", closureId)
      .eq("space_id", spaceId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to remove closure",
    };
  }
}
