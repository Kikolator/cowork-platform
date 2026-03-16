"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@cowork/db/types/database";
import { updateMemberSchema, addMemberNoteSchema } from "./schemas";

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

/** Coerce empty strings and sentinel values to null */
function emptyToNull(v: string | null | undefined): string | null {
  if (v == null || v === "" || v === "__none__") return null;
  return v;
}

export async function updateMember(memberId: string, input: unknown) {
  const parsed = updateMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, spaceId } = await getSpaceId();
  const d = parsed.data;

  const { error } = await supabase
    .from("members")
    .update({
      plan_id: d.planId,
      status: d.status,
      fixed_desk_id: emptyToNull(d.fixedDeskId),
      has_twenty_four_seven: d.hasTwentyFourSeven,
      access_code: emptyToNull(d.accessCode),
      alarm_approved: d.alarmApproved,
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
    .eq("space_id", spaceId);

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidatePath("/admin/members");
  return { success: true as const };
}

export async function addMemberNote(input: unknown) {
  const parsed = addMemberNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, user, spaceId } = await getSpaceId();
  const d = parsed.data;

  const { error } = await supabase.from("member_notes").insert({
    space_id: spaceId,
    member_id: d.memberId,
    author_id: user.id,
    content: d.content,
    category: d.category,
  });

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidatePath("/admin/members");
  return { success: true as const };
}
