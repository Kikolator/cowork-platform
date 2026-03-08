"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { brandingSchema, operationsSchema, fiscalSchema } from "./schemas";

async function getSpaceId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const spaceId = user.app_metadata?.space_id as string | undefined;
  if (!spaceId) throw new Error("No space context");
  return { supabase, spaceId };
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
    .select("slug, tenant_id")
    .eq("id", spaceId)
    .single();

  if (current && parsed.data.slug !== current.slug) {
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

  const { error } = await supabase
    .from("spaces")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      logo_url: parsed.data.logoUrl || null,
      favicon_url: parsed.data.faviconUrl || null,
      primary_color: parsed.data.primaryColor,
      accent_color: parsed.data.accentColor,
    })
    .eq("id", spaceId);

  if (error) return { success: false as const, error: error.message };

  revalidatePath("/admin/settings");
  return { success: true as const, slugChanged: current?.slug !== parsed.data.slug };
}

export async function updateSpaceOperations(input: unknown) {
  const parsed = operationsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, spaceId } = await getSpaceId();

  const { error } = await supabase
    .from("spaces")
    .update({
      timezone: parsed.data.timezone,
      currency: parsed.data.currency,
      default_locale: parsed.data.defaultLocale,
      business_hours: parsed.data.businessHours,
    })
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

export async function updateFeatureFlag(key: string, value: boolean) {
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
