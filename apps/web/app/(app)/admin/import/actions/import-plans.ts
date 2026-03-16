"use server";

import { importPlanSchema } from "../schemas";
import { getAdminContext, type ImportResult } from "./shared";

export async function importPlans(
  rows: Record<string, string>[],
): Promise<ImportResult> {
  const { admin, spaceId } = await getAdminContext();
  const result: ImportResult = { inserted: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const parsed = importPlanSchema.safeParse(rows[i]);
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
        .from("plans")
        .select("id")
        .eq("space_id", spaceId)
        .eq("external_id", data.external_id)
        .maybeSingle();

      if (existing) {
        result.skipped++;
        continue;
      }
    }

    // Check slug dedup
    const { data: bySlug } = await admin
      .from("plans")
      .select("id")
      .eq("space_id", spaceId)
      .eq("slug", data.slug)
      .maybeSingle();

    if (bySlug) {
      result.skipped++;
      continue;
    }

    const { error } = await admin.from("plans").insert({
      space_id: spaceId,
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      price_cents: data.price_cents,
      currency: data.currency,
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
