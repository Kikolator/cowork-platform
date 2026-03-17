"use server";

import { importBookingSchema } from "../schemas";
import { getAdminContext, type ImportResult } from "./shared";

export async function importBookings(
  rows: Record<string, string>[],
): Promise<ImportResult> {
  const { admin, spaceId } = await getAdminContext();
  const result: ImportResult = { inserted: 0, skipped: 0, errors: [] };

  // Pre-fetch resources for name resolution
  const { data: resources } = await admin
    .from("resources")
    .select("id, name, external_id")
    .eq("space_id", spaceId);

  const resByName = new Map(
    (resources ?? []).map((r) => [r.name.toLowerCase(), r.id]),
  );
  const resByExtId = new Map(
    (resources ?? [])
      .filter((r) => r.external_id)
      .map((r) => [r.external_id!, r.id]),
  );

  // Pre-fetch members for email + name resolution
  const { data: members } = await admin
    .from("members")
    .select("id, user_id")
    .eq("space_id", spaceId);

  // Get emails and names from shared_profiles for these users
  const userIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await admin
        .from("shared_profiles")
        .select("id, email, full_name")
        .in("id", userIds)
    : { data: [] };

  const memberByEmail = new Map<string, { memberId: string; userId: string }>();
  const memberByName = new Map<string, { memberId: string; userId: string }>();
  for (const profile of profiles ?? []) {
    const member = members?.find((m) => m.user_id === profile.id);
    if (member) {
      memberByEmail.set(profile.email.toLowerCase(), {
        memberId: member.id,
        userId: member.user_id,
      });
      if (profile.full_name) {
        const normalized = profile.full_name.toLowerCase().replace(/\s+/g, " ").trim();
        memberByName.set(normalized, {
          memberId: member.id,
          userId: member.user_id,
        });
      }
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const parsed = importBookingSchema.safeParse(rows[i]);
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
        .from("bookings")
        .select("id")
        .eq("space_id", spaceId)
        .eq("external_id", data.external_id)
        .maybeSingle();

      if (existing) {
        result.skipped++;
        continue;
      }
    }

    // Resolve resource
    const resourceId =
      resByName.get(data.resource_name.toLowerCase()) ??
      resByExtId.get(data.resource_name);

    if (!resourceId) {
      result.errors.push({
        row: i + 1,
        message: `Resource "${data.resource_name}" not found. Import resources first.`,
      });
      continue;
    }

    // Resolve member by email first, then by name
    const member = data.member_email
      ? memberByEmail.get(data.member_email)
      : data.member_name
        ? memberByName.get(data.member_name.toLowerCase().replace(/\s+/g, " ").trim())
        : undefined;

    if (!member) {
      const identifier = data.member_email ?? data.member_name ?? "unknown";
      result.errors.push({
        row: i + 1,
        message: `Member "${identifier}" not found. Import members first.`,
      });
      continue;
    }

    const { error } = await admin.from("bookings").insert({
      space_id: spaceId,
      user_id: member.userId,
      resource_id: resourceId,
      start_time: data.start_time,
      end_time: data.end_time,
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
