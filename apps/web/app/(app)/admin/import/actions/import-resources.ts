"use server";

import { importResourceSchema } from "../schemas";
import { getAdminContext, type ImportResult } from "./shared";

export async function importResources(
  rows: Record<string, string>[],
): Promise<ImportResult> {
  const { admin, spaceId } = await getAdminContext();
  const result: ImportResult = { inserted: 0, skipped: 0, errors: [] };

  // Pre-fetch resource types for name → id resolution
  const { data: resourceTypes } = await admin
    .from("resource_types")
    .select("id, name, slug")
    .eq("space_id", spaceId);

  const rtByName = new Map(
    (resourceTypes ?? []).map((rt) => [rt.name.toLowerCase(), rt.id]),
  );
  const rtBySlug = new Map(
    (resourceTypes ?? []).map((rt) => [rt.slug.toLowerCase(), rt.id]),
  );

  // Default resource type (first available, or null)
  const defaultRtId = resourceTypes?.[0]?.id;

  for (let i = 0; i < rows.length; i++) {
    const parsed = importResourceSchema.safeParse(rows[i]);
    if (!parsed.success) {
      result.errors.push({
        row: i + 1,
        message: parsed.error.issues[0]?.message ?? "Invalid data",
      });
      continue;
    }

    const data = parsed.data;

    // Check external_id dedup
    if (data.external_id) {
      const { data: existing } = await admin
        .from("resources")
        .select("id")
        .eq("space_id", spaceId)
        .eq("external_id", data.external_id)
        .maybeSingle();

      if (existing) {
        result.skipped++;
        continue;
      }
    }

    // Resolve resource type
    const rtName = data.resource_type_name?.toLowerCase();
    const resourceTypeId =
      (rtName && (rtByName.get(rtName) ?? rtBySlug.get(rtName))) ||
      defaultRtId;

    if (!resourceTypeId) {
      result.errors.push({
        row: i + 1,
        message: "No resource type found. Import resource types first.",
      });
      continue;
    }

    const { error } = await admin.from("resources").insert({
      space_id: spaceId,
      resource_type_id: resourceTypeId,
      name: data.name,
      floor: data.floor,
      capacity: data.capacity,
      status: data.status,
      external_id: data.external_id ?? null,
    });

    if (error) {
      result.errors.push({ row: i + 1, message: error.message });
    } else {
      result.inserted++;
    }
  }

  return result;
}
