"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@cowork/db/types/database";
import {
  personalProfileSchema,
  professionalBillingSchema,
  notificationsSchema,
} from "./schemas";

type FiscalIdType = Database["public"]["Enums"]["fiscal_id_type"];

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

function emptyToNull(v: string | null | undefined): string | null {
  if (v == null || v === "" || v === "__none__") return null;
  return v;
}

export async function updatePersonalProfile(input: unknown) {
  const parsed = personalProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await getSpaceId();
  const d = parsed.data;

  const { error } = await supabase
    .from("shared_profiles")
    .update({
      full_name: emptyToNull(d.fullName),
      phone: emptyToNull(d.phone),
      avatar_url: emptyToNull(d.avatarUrl),
      preferred_lang: d.preferredLang,
    })
    .eq("id", user.id);

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidatePath("/profile");
  return { success: true as const };
}

export async function updateProfileMember(memberId: string, input: unknown) {
  const parsed = professionalBillingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, user, spaceId } = await getSpaceId();
  const d = parsed.data;

  const { error } = await supabase
    .from("members")
    .update({
      company: emptyToNull(d.company),
      role_title: emptyToNull(d.roleTitle),
      billing_entity_type: d.billingEntityType,
      fiscal_id_type: emptyToNull(d.fiscalIdType) as FiscalIdType | null,
      fiscal_id: emptyToNull(d.fiscalId),
      billing_company_name: emptyToNull(d.billingCompanyName),
      billing_company_tax_id_type: emptyToNull(d.billingCompanyTaxIdType) as FiscalIdType | null,
      billing_company_tax_id: emptyToNull(d.billingCompanyTaxId),
      billing_address_line1: emptyToNull(d.billingAddressLine1),
      billing_address_line2: emptyToNull(d.billingAddressLine2),
      billing_city: emptyToNull(d.billingCity),
      billing_postal_code: emptyToNull(d.billingPostalCode),
      billing_state_province: emptyToNull(d.billingStateProvince),
      billing_country: emptyToNull(d.billingCountry),
    })
    .eq("id", memberId)
    .eq("user_id", user.id)
    .eq("space_id", spaceId);

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidatePath("/profile");
  return { success: true as const };
}

export async function updateNotificationPreferences(input: unknown) {
  const parsed = notificationsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, user, spaceId } = await getSpaceId();
  const d = parsed.data;

  const { error } = await supabase
    .from("notification_preferences")
    .upsert(
      {
        space_id: spaceId,
        user_id: user.id,
        booking_reminders: d.bookingReminders,
        credit_warnings: d.creditWarnings,
        marketing: d.marketing,
        weekly_summary: d.weeklySummary,
        preferred_channel: d.preferredChannel,
      },
      { onConflict: "space_id,user_id" },
    );

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidatePath("/profile");
  return { success: true as const };
}
