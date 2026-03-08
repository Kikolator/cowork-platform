"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const RESERVED_SLUGS = [
  "app",
  "www",
  "api",
  "admin",
  "auth",
  "login",
  "onboard",
  "dashboard",
  "static",
  "assets",
  "cdn",
] as const;

const DEFAULT_RATE_CENTS: Record<string, number> = {
  meeting_room: 490,
  podcast_room: 3500,
  private_office: 600,
  event_space: 5000,
  phone_booth: 200,
};

const dayHoursSchema = z
  .object({
    open: z.string().regex(/^\d{2}:\d{2}$/),
    close: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .nullable();

const roomSchema = z.object({
  type: z.string().min(1),
  name: z.string().min(1).max(100),
  capacity: z.number().int().min(1).max(500),
});

const onboardSchema = z.object({
  businessName: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
  countryCode: z.string().length(2),
  timezone: z.string(),
  currency: z.string().length(3),
  businessHours: z.object({
    mon: dayHoursSchema,
    tue: dayHoursSchema,
    wed: dayHoursSchema,
    thu: dayHoursSchema,
    fri: dayHoursSchema,
    sat: dayHoursSchema,
    sun: dayHoursSchema,
  }),
  deskCount: z.number().int().min(1).max(200),
  rooms: z.array(roomSchema).max(20),
});

type OnboardInput = z.infer<typeof onboardSchema>;

export async function checkSlugAvailable(slug: string): Promise<boolean> {
  if (RESERVED_SLUGS.includes(slug as (typeof RESERVED_SLUGS)[number])) {
    return false;
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("spaces")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  return !data;
}

export async function createTenantAndSpace(input: OnboardInput): Promise<{
  success: boolean;
  spaceSlug?: string;
  error?: string;
}> {
  const parsed = onboardSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const data = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const slugAvailable = await checkSlugAvailable(data.slug);
  if (!slugAvailable) {
    return { success: false, error: "Slug is already taken" };
  }

  const admin = createAdminClient();

  let tenantId: string | null = null;
  let spaceId: string | null = null;

  try {
    // Create tenant
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const { data: tenant, error: tenantError } = await admin
      .from("tenants")
      .insert({
        name: data.businessName,
        slug: data.slug,
        status: "trial",
        trial_ends_at: trialEndsAt.toISOString(),
      })
      .select("id")
      .single();

    if (tenantError || !tenant) {
      return { success: false, error: "Failed to create tenant" };
    }
    tenantId = tenant.id;

    // Create space
    const { data: space, error: spaceError } = await admin
      .from("spaces")
      .insert({
        tenant_id: tenantId,
        name: data.businessName,
        slug: data.slug,
        country_code: data.countryCode,
        timezone: data.timezone,
        currency: data.currency,
        business_hours: data.businessHours,
        features: {
          passes: true,
          credits: true,
          leads: true,
          recurring_bookings: true,
          guest_passes: true,
          open_registration: false,
        },
        require_fiscal_id: data.countryCode === "ES",
      })
      .select("id")
      .single();

    if (spaceError || !space) {
      throw new Error("Failed to create space");
    }
    spaceId = space.id;

    // Create space_users (owner)
    const { error: suError } = await admin
      .from("space_users")
      .insert({ user_id: user.id, space_id: spaceId, role: "owner" });

    if (suError) {
      throw new Error("Failed to create space user");
    }

    // Build resource types: always "desk" + unique room types
    const roomTypeMap = new Map<string, { name: string; rateCents: number }>();
    roomTypeMap.set("desk", { name: "Desk", rateCents: 375 });

    for (const room of data.rooms) {
      if (!roomTypeMap.has(room.type)) {
        roomTypeMap.set(room.type, {
          name: room.type
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase()),
          rateCents: DEFAULT_RATE_CENTS[room.type] ?? 500,
        });
      }
    }

    const { data: insertedTypes, error: rtError } = await admin
      .from("resource_types")
      .insert(
        Array.from(roomTypeMap.entries()).map(([slug, rt], i) => ({
          space_id: spaceId!,
          slug,
          name: rt.name,
          bookable: true,
          billable: true,
          sort_order: i,
        }))
      )
      .select("id, slug");

    if (rtError || !insertedTypes) {
      throw new Error("Failed to create resource types");
    }

    // Create rate_config
    const { error: rcError } = await admin.from("rate_config").insert(
      insertedTypes.map((rt) => ({
        space_id: spaceId!,
        resource_type_id: rt.id,
        rate_cents: roomTypeMap.get(rt.slug)?.rateCents ?? 500,
        currency: data.currency,
      }))
    );

    if (rcError) {
      throw new Error("Failed to create rate config");
    }

    // Create resources
    const typeIdMap = new Map(insertedTypes.map((rt) => [rt.slug, rt.id]));

    const resources: Array<{
      space_id: string;
      resource_type_id: string;
      name: string;
      capacity: number;
    }> = [];

    const deskTypeId = typeIdMap.get("desk");
    if (deskTypeId) {
      for (let i = 1; i <= data.deskCount; i++) {
        resources.push({
          space_id: spaceId,
          resource_type_id: deskTypeId,
          name: `Desk ${i}`,
          capacity: 1,
        });
      }
    }

    for (const room of data.rooms) {
      const rtId = typeIdMap.get(room.type);
      if (rtId) {
        resources.push({
          space_id: spaceId,
          resource_type_id: rtId,
          name: room.name,
          capacity: room.capacity,
        });
      }
    }

    if (resources.length > 0) {
      const { error: resError } = await admin
        .from("resources")
        .insert(resources);

      if (resError) {
        throw new Error("Failed to create resources");
      }
    }

    // Set JWT claims
    const { error: claimsError } = await admin.auth.admin.updateUserById(
      user.id,
      {
        app_metadata: {
          space_id: spaceId,
          tenant_id: tenantId,
          space_role: "owner",
        },
      }
    );

    if (claimsError) {
      throw new Error("Failed to set JWT claims");
    }

    await supabase.auth.refreshSession();

    return { success: true, spaceSlug: data.slug };
  } catch (err) {
    if (spaceId) {
      await admin.from("resources").delete().eq("space_id", spaceId);
      await admin.from("rate_config").delete().eq("space_id", spaceId);
      await admin.from("resource_types").delete().eq("space_id", spaceId);
      await admin.from("space_users").delete().eq("space_id", spaceId);
      await admin.from("spaces").delete().eq("id", spaceId);
    }
    if (tenantId) {
      await admin.from("tenants").delete().eq("id", tenantId);
    }

    const message =
      err instanceof Error ? err.message : "Something went wrong";
    return { success: false, error: message };
  }
}
