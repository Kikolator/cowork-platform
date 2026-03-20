"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resourceSchema, resourceTypeSchema } from "./schemas";

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

export async function createResource(input: unknown) {
  const parsed = resourceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, spaceId } = await getSpaceId();
  const { resourceTypeId, ...rest } = parsed.data;

  const { error } = await supabase.from("resources").insert({
    space_id: spaceId,
    resource_type_id: resourceTypeId,
    name: rest.name,
    capacity: rest.capacity,
    floor: rest.floor,
    sort_order: rest.sortOrder,
    image_url: rest.imageUrl ?? null,
  });

  if (error) return { success: false as const, error: error.message };

  revalidatePath("/admin/resources");
  return { success: true as const };
}

export async function updateResource(resourceId: string, input: unknown) {
  const parsed = resourceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, spaceId } = await getSpaceId();
  const { resourceTypeId, ...rest } = parsed.data;

  const { error } = await supabase
    .from("resources")
    .update({
      resource_type_id: resourceTypeId,
      name: rest.name,
      capacity: rest.capacity,
      floor: rest.floor,
      sort_order: rest.sortOrder,
      image_url: rest.imageUrl ?? null,
    })
    .eq("id", resourceId)
    .eq("space_id", spaceId);

  if (error) return { success: false as const, error: error.message };

  revalidatePath("/admin/resources");
  return { success: true as const };
}

export async function deleteResource(resourceId: string) {
  const { supabase, spaceId } = await getSpaceId();

  // Check for future bookings
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("resource_id", resourceId)
    .eq("space_id", spaceId)
    .gte("start_time", new Date().toISOString())
    .neq("status", "cancelled");

  if (count && count > 0) {
    return {
      success: false as const,
      error: "Cannot delete resource with future bookings. Cancel bookings first.",
    };
  }

  const { error } = await supabase
    .from("resources")
    .delete()
    .eq("id", resourceId)
    .eq("space_id", spaceId);

  if (error) return { success: false as const, error: error.message };

  revalidatePath("/admin/resources");
  return { success: true as const };
}

export async function updateResourceStatus(
  resourceId: string,
  status: "available" | "occupied" | "out_of_service"
) {
  const { supabase, spaceId } = await getSpaceId();

  const { error } = await supabase
    .from("resources")
    .update({ status })
    .eq("id", resourceId)
    .eq("space_id", spaceId);

  if (error) return { success: false as const, error: error.message };

  revalidatePath("/admin/resources");
  return { success: true as const };
}

export async function createResourceType(input: unknown) {
  const parsed = resourceTypeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, spaceId } = await getSpaceId();

  // Check slug uniqueness
  const { data: existing } = await supabase
    .from("resource_types")
    .select("id")
    .eq("space_id", spaceId)
    .eq("slug", parsed.data.slug)
    .maybeSingle();

  if (existing) {
    return { success: false as const, error: "A resource type with this slug already exists" };
  }

  const { data: rt, error } = await supabase
    .from("resource_types")
    .insert({
      space_id: spaceId,
      name: parsed.data.name,
      slug: parsed.data.slug,
      bookable: parsed.data.bookable,
      billable: parsed.data.billable,
    })
    .select("id")
    .single();

  if (error || !rt) return { success: false as const, error: error?.message ?? "Failed to create" };

  // Create default rate config if billable
  if (parsed.data.billable && parsed.data.defaultRateCents !== undefined) {
    await supabase.from("rate_config").insert({
      space_id: spaceId,
      resource_type_id: rt.id,
      rate_cents: parsed.data.defaultRateCents,
    });
  }

  revalidatePath("/admin/resources");
  return { success: true as const };
}

export async function updateResourceType(resourceTypeId: string, input: unknown) {
  const parsed = resourceTypeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, spaceId } = await getSpaceId();

  // Check slug uniqueness (exclude current)
  const { data: existing } = await supabase
    .from("resource_types")
    .select("id")
    .eq("space_id", spaceId)
    .eq("slug", parsed.data.slug)
    .neq("id", resourceTypeId)
    .maybeSingle();

  if (existing) {
    return { success: false as const, error: "A resource type with this slug already exists" };
  }

  const { error } = await supabase
    .from("resource_types")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      bookable: parsed.data.bookable,
      billable: parsed.data.billable,
    })
    .eq("id", resourceTypeId)
    .eq("space_id", spaceId);

  if (error) return { success: false as const, error: error.message };

  revalidatePath("/admin/resources");
  return { success: true as const };
}

export async function updateRate(resourceTypeId: string, rateCents: number) {
  if (!Number.isInteger(rateCents) || rateCents < 0) {
    return { success: false as const, error: "Rate must be a non-negative integer" };
  }

  const { supabase, spaceId } = await getSpaceId();

  const { error } = await supabase
    .from("rate_config")
    .update({ rate_cents: rateCents })
    .eq("resource_type_id", resourceTypeId)
    .eq("space_id", spaceId);

  if (error) return { success: false as const, error: error.message };

  revalidatePath("/admin/resources");
  return { success: true as const };
}

export async function deleteResourceType(resourceTypeId: string) {
  const { supabase, spaceId } = await getSpaceId();

  // Check for existing resources of this type
  const { count } = await supabase
    .from("resources")
    .select("id", { count: "exact", head: true })
    .eq("resource_type_id", resourceTypeId)
    .eq("space_id", spaceId);

  if (count && count > 0) {
    return {
      success: false as const,
      error: "Cannot delete resource type that has resources. Remove all resources of this type first.",
    };
  }

  // Delete rate config first
  await supabase
    .from("rate_config")
    .delete()
    .eq("resource_type_id", resourceTypeId)
    .eq("space_id", spaceId);

  const { error } = await supabase
    .from("resource_types")
    .delete()
    .eq("id", resourceTypeId)
    .eq("space_id", spaceId);

  if (error) return { success: false as const, error: error.message };

  revalidatePath("/admin/resources");
  return { success: true as const };
}
