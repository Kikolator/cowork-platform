"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { planSchema, membersPerDeskToWeight } from "./schemas";

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

export async function createPlan(input: unknown) {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, spaceId } = await getSpaceId();
  const { creditConfig, priceCents, ivaRate, hasFixedDesk, accessType, sortOrder, membersPerDesk, ...rest } = parsed.data;
  const deskWeight = membersPerDeskToWeight(membersPerDesk);

  // Check slug uniqueness
  const { data: existing } = await supabase
    .from("plans")
    .select("id")
    .eq("space_id", spaceId)
    .eq("slug", rest.slug)
    .maybeSingle();

  if (existing) {
    return { success: false as const, error: "A plan with this slug already exists" };
  }

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .insert({
      space_id: spaceId,
      name: rest.name,
      slug: rest.slug,
      description: rest.description || null,
      price_cents: priceCents,
      currency: rest.currency,
      iva_rate: ivaRate,
      access_type: accessType,
      has_fixed_desk: hasFixedDesk,
      desk_weight: deskWeight,
      sort_order: sortOrder,
    })
    .select("id")
    .single();

  if (planError || !plan) {
    return { success: false as const, error: planError?.message ?? "Failed to create plan" };
  }

  // Insert credit config
  if (creditConfig.length > 0) {
    const rows = creditConfig.map((cc) => ({
      space_id: spaceId,
      plan_id: plan.id,
      resource_type_id: cc.resourceTypeId,
      monthly_minutes: cc.monthlyMinutes,
      is_unlimited: cc.isUnlimited,
    }));

    const { error: ccError } = await supabase.from("plan_credit_config").insert(rows);
    if (ccError) {
      // Cleanup the plan on partial failure
      await supabase.from("plans").delete().eq("id", plan.id);
      return { success: false as const, error: ccError.message };
    }
  }

  revalidatePath("/admin/plans");
  return { success: true as const, planId: plan.id };
}

export async function updatePlan(planId: string, input: unknown) {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, spaceId } = await getSpaceId();
  const { creditConfig, priceCents, ivaRate, hasFixedDesk, accessType, sortOrder, membersPerDesk, ...rest } = parsed.data;
  const deskWeight = membersPerDeskToWeight(membersPerDesk);

  // Check slug uniqueness (exclude current plan)
  const { data: existing } = await supabase
    .from("plans")
    .select("id")
    .eq("space_id", spaceId)
    .eq("slug", rest.slug)
    .neq("id", planId)
    .maybeSingle();

  if (existing) {
    return { success: false as const, error: "A plan with this slug already exists" };
  }

  // Fetch current price to detect price/currency changes
  const { data: current, error: fetchError } = await supabase
    .from("plans")
    .select("price_cents, currency")
    .eq("id", planId)
    .eq("space_id", spaceId)
    .single();

  if (fetchError || !current) {
    return { success: false as const, error: "Plan not found" };
  }

  const priceChanged = current.price_cents !== priceCents || current.currency !== rest.currency;

  const { error: planError } = await supabase
    .from("plans")
    .update({
      name: rest.name,
      slug: rest.slug,
      description: rest.description || null,
      price_cents: priceCents,
      currency: rest.currency,
      iva_rate: ivaRate,
      access_type: accessType,
      has_fixed_desk: hasFixedDesk,
      desk_weight: deskWeight,
      sort_order: sortOrder,
      // Invalidate Stripe price so lazy sync creates a fresh one on next checkout
      ...(priceChanged && { stripe_price_id: null, stripe_product_id: null }),
    })
    .eq("id", planId)
    .eq("space_id", spaceId);

  if (planError) {
    return { success: false as const, error: planError.message };
  }

  // Replace credit config: delete existing, insert new
  await supabase.from("plan_credit_config").delete().eq("plan_id", planId).eq("space_id", spaceId);

  if (creditConfig.length > 0) {
    const rows = creditConfig.map((cc) => ({
      space_id: spaceId,
      plan_id: planId,
      resource_type_id: cc.resourceTypeId,
      monthly_minutes: cc.monthlyMinutes,
      is_unlimited: cc.isUnlimited,
    }));

    const { error: ccError } = await supabase.from("plan_credit_config").insert(rows);
    if (ccError) {
      return { success: false as const, error: ccError.message };
    }
  }

  revalidatePath("/admin/plans");
  return { success: true as const };
}

export async function deletePlan(planId: string) {
  const { supabase, spaceId } = await getSpaceId();

  // Check for members on this plan
  const { count } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", planId)
    .eq("space_id", spaceId);

  if (count && count > 0) {
    return {
      success: false as const,
      error: "Cannot delete plan with active members. Move or remove members first.",
    };
  }

  // Delete credit config first (should cascade, but be explicit)
  await supabase.from("plan_credit_config").delete().eq("plan_id", planId).eq("space_id", spaceId);

  const { error } = await supabase.from("plans").delete().eq("id", planId).eq("space_id", spaceId);

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidatePath("/admin/plans");
  return { success: true as const };
}

export async function togglePlanActive(planId: string, active: boolean) {
  const { supabase, spaceId } = await getSpaceId();

  const { error } = await supabase
    .from("plans")
    .update({ active })
    .eq("id", planId)
    .eq("space_id", spaceId);

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidatePath("/admin/plans");
  return { success: true as const };
}
