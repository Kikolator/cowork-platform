"use server";

import { importLeadSchema } from "../schemas";
import { getAdminContext, type ImportResult } from "./shared";

export async function importLeads(
  rows: Record<string, string>[],
): Promise<ImportResult> {
  const { admin, spaceId } = await getAdminContext();
  const result: ImportResult = { inserted: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const parsed = importLeadSchema.safeParse(rows[i]);
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
        .from("leads")
        .select("id")
        .eq("space_id", spaceId)
        .eq("external_id", data.external_id)
        .maybeSingle();

      if (existing) {
        result.skipped++;
        continue;
      }
    }

    // Check email dedup within space
    const { data: byEmail } = await admin
      .from("leads")
      .select("id")
      .eq("space_id", spaceId)
      .eq("email", data.email)
      .maybeSingle();

    if (byEmail) {
      result.skipped++;
      continue;
    }

    const { error } = await admin.from("leads").insert({
      space_id: spaceId,
      email: data.email,
      full_name: data.full_name ?? null,
      company: data.company ?? null,
      phone: data.phone ?? null,
      status: data.status,
      admin_notes: data.admin_notes ?? null,
      source: data.source,
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
