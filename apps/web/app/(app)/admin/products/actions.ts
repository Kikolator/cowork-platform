"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { productSchema, purchaseFlowForCategory } from "./schemas";

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

export async function createProduct(input: unknown) {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, spaceId } = await getSpaceId();
  const { priceCents, ivaRate, sortOrder, creditGrantConfig, visibilityRules, planId, ...rest } = parsed.data;

  // Check slug uniqueness
  const { data: existing } = await supabase
    .from("products")
    .select("id")
    .eq("space_id", spaceId)
    .eq("slug", rest.slug)
    .maybeSingle();

  if (existing) {
    return { success: false as const, error: "A product with this slug already exists" };
  }

  const { error } = await supabase.from("products").insert({
    space_id: spaceId,
    name: rest.name,
    slug: rest.slug,
    description: rest.description || null,
    category: rest.category,
    purchase_flow: purchaseFlowForCategory(rest.category),
    price_cents: priceCents,
    currency: rest.currency,
    iva_rate: ivaRate,
    plan_id: planId || null,
    credit_grant_config: creditGrantConfig
      ? { resource_type_id: creditGrantConfig.resourceTypeId, minutes: creditGrantConfig.minutes }
      : null,
    visibility_rules: {
      require_membership: visibilityRules.requireMembership ?? false,
      require_no_membership: visibilityRules.requireNoMembership ?? false,
      require_plan_ids: visibilityRules.requirePlanIds ?? [],
      exclude_unlimited: visibilityRules.excludeUnlimited ?? false,
    },
    active: rest.active,
    sort_order: sortOrder,
  });

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidatePath("/admin/products");
  return { success: true as const };
}

export async function updateProduct(productId: string, input: unknown) {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, spaceId } = await getSpaceId();
  const { priceCents, ivaRate, sortOrder, creditGrantConfig, visibilityRules, planId, ...rest } = parsed.data;

  // Check slug uniqueness (exclude self)
  const { data: existing } = await supabase
    .from("products")
    .select("id")
    .eq("space_id", spaceId)
    .eq("slug", rest.slug)
    .neq("id", productId)
    .maybeSingle();

  if (existing) {
    return { success: false as const, error: "A product with this slug already exists" };
  }

  const { error } = await supabase
    .from("products")
    .update({
      name: rest.name,
      slug: rest.slug,
      description: rest.description || null,
      category: rest.category,
      purchase_flow: purchaseFlowForCategory(rest.category),
      price_cents: priceCents,
      currency: rest.currency,
      iva_rate: ivaRate,
      plan_id: planId || null,
      credit_grant_config: creditGrantConfig
        ? { resource_type_id: creditGrantConfig.resourceTypeId, minutes: creditGrantConfig.minutes }
        : null,
      visibility_rules: {
        require_membership: visibilityRules.requireMembership ?? false,
        require_no_membership: visibilityRules.requireNoMembership ?? false,
        require_plan_ids: visibilityRules.requirePlanIds ?? [],
        exclude_unlimited: visibilityRules.excludeUnlimited ?? false,
      },
      active: rest.active,
      sort_order: sortOrder,
    })
    .eq("id", productId)
    .eq("space_id", spaceId);

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidatePath("/admin/products");
  return { success: true as const };
}

export async function deleteProduct(productId: string) {
  const { supabase, spaceId } = await getSpaceId();

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("space_id", spaceId);

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidatePath("/admin/products");
  return { success: true as const };
}

export async function toggleProductActive(productId: string, active: boolean) {
  const { supabase, spaceId } = await getSpaceId();

  const { error } = await supabase
    .from("products")
    .update({ active })
    .eq("id", productId)
    .eq("space_id", spaceId);

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidatePath("/admin/products");
  return { success: true as const };
}
