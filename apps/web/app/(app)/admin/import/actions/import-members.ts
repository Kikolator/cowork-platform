"use server";

import { importMemberSchema } from "../schemas";
import { getAdminContext, type ImportResult } from "./shared";

export async function importMembers(
  rows: Record<string, string>[],
): Promise<ImportResult> {
  const { admin, spaceId } = await getAdminContext();
  const result: ImportResult = { inserted: 0, skipped: 0, errors: [] };

  // Pre-fetch plans for name → id resolution
  const { data: plans } = await admin
    .from("plans")
    .select("id, name, slug")
    .eq("space_id", spaceId);

  const planByName = new Map(
    (plans ?? []).map((p) => [p.name.toLowerCase(), p.id]),
  );
  const planBySlug = new Map(
    (plans ?? []).map((p) => [p.slug.toLowerCase(), p.id]),
  );
  const defaultPlanId = plans?.[0]?.id;

  for (let i = 0; i < rows.length; i++) {
    const parsed = importMemberSchema.safeParse(rows[i]);
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
        .from("members")
        .select("id")
        .eq("space_id", spaceId)
        .eq("external_id", data.external_id)
        .maybeSingle();

      if (existing) {
        result.skipped++;
        continue;
      }
    }

    // Create or find auth user
    let userId: string;
    const { data: authUser, error: authError } =
      await admin.auth.admin.createUser({
        email: data.email,
        email_confirm: false,
      });

    if (authError) {
      // User likely already exists — look them up
      const { data: existingUsers } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1,
      });
      const found = existingUsers?.users?.find(
        (u) => u.email?.toLowerCase() === data.email,
      );

      if (!found) {
        // Try lookup via shared_profiles
        const { data: profile } = await admin
          .from("shared_profiles")
          .select("id")
          .eq("email", data.email)
          .maybeSingle();

        if (!profile) {
          result.errors.push({
            row: i + 1,
            message: `Cannot create user for ${data.email}: ${authError.message}`,
          });
          continue;
        }
        userId = profile.id;
      } else {
        userId = found.id;
      }
    } else {
      userId = authUser.user.id;
    }

    // Update shared_profiles with name/phone if available
    if (data.full_name || data.phone) {
      const updates: Record<string, string> = {};
      if (data.full_name) updates.full_name = data.full_name;
      if (data.phone) updates.phone = data.phone;
      await admin
        .from("shared_profiles")
        .update(updates)
        .eq("id", userId);
    }

    // Ensure space_users entry exists
    await admin.from("space_users").upsert(
      { user_id: userId, space_id: spaceId, role: "member" },
      { onConflict: "user_id,space_id" },
    );

    // Resolve plan
    const planName = data.plan_name?.toLowerCase();
    const planId =
      (planName && (planByName.get(planName) ?? planBySlug.get(planName))) ||
      defaultPlanId;

    if (!planId) {
      result.errors.push({
        row: i + 1,
        message: "No plan found. Import plans first.",
      });
      continue;
    }

    // Check if member already exists in this space
    const { data: existingMember } = await admin
      .from("members")
      .select("id")
      .eq("space_id", spaceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingMember) {
      result.skipped++;
      continue;
    }

    const { error } = await admin.from("members").insert({
      space_id: spaceId,
      user_id: userId,
      plan_id: planId,
      status: data.status,
      company: data.company ?? null,
      joined_at: data.joined_at ?? new Date().toISOString(),
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
