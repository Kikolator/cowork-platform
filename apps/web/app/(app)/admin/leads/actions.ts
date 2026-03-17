"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { leadSchema, LEAD_STATUSES } from "./schemas";

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

export async function createLead(input: unknown) {
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, spaceId } = await getSpaceId();
  const { fullName, trialDate, trialConfirmed, adminNotes, ...rest } = parsed.data;

  // Check email uniqueness among non-archived leads
  const { data: existing } = await supabase
    .from("leads")
    .select("id")
    .eq("space_id", spaceId)
    .eq("email", rest.email)
    .is("archived_at", null)
    .maybeSingle();

  if (existing) {
    return { success: false as const, error: "A lead with this email already exists" };
  }

  const { error } = await supabase.from("leads").insert({
    space_id: spaceId,
    email: rest.email,
    full_name: fullName || null,
    phone: rest.phone || null,
    company: rest.company || null,
    status: rest.status,
    source: rest.source,
    trial_date: trialDate || null,
    trial_confirmed: trialConfirmed,
    admin_notes: adminNotes || null,
  });

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidatePath("/admin/leads");
  return { success: true as const };
}

export async function updateLead(leadId: string, input: unknown) {
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, spaceId } = await getSpaceId();
  const { fullName, trialDate, trialConfirmed, adminNotes, ...rest } = parsed.data;

  // Check email uniqueness (exclude self)
  const { data: existing } = await supabase
    .from("leads")
    .select("id")
    .eq("space_id", spaceId)
    .eq("email", rest.email)
    .is("archived_at", null)
    .neq("id", leadId)
    .maybeSingle();

  if (existing) {
    return { success: false as const, error: "A lead with this email already exists" };
  }

  const { error } = await supabase
    .from("leads")
    .update({
      email: rest.email,
      full_name: fullName || null,
      phone: rest.phone || null,
      company: rest.company || null,
      status: rest.status,
      source: rest.source,
      trial_date: trialDate || null,
      trial_confirmed: trialConfirmed,
      admin_notes: adminNotes || null,
    })
    .eq("id", leadId)
    .eq("space_id", spaceId);

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidatePath("/admin/leads");
  return { success: true as const };
}

export async function updateLeadStatus(leadId: string, status: string) {
  if (!LEAD_STATUSES.includes(status as (typeof LEAD_STATUSES)[number])) {
    return { success: false as const, error: "Invalid status" };
  }

  const { supabase, spaceId } = await getSpaceId();

  const { error } = await supabase
    .from("leads")
    .update({ status: status as (typeof LEAD_STATUSES)[number] })
    .eq("id", leadId)
    .eq("space_id", spaceId);

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidatePath("/admin/leads");
  return { success: true as const };
}

export async function archiveLead(leadId: string) {
  const { supabase, spaceId } = await getSpaceId();

  const { error } = await supabase
    .from("leads")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("space_id", spaceId);

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidatePath("/admin/leads");
  return { success: true as const };
}

export async function updateAdminNotes(leadId: string, notes: string) {
  const { supabase, spaceId } = await getSpaceId();

  const { error } = await supabase
    .from("leads")
    .update({
      admin_notes: notes || null,
      last_contacted_at: new Date().toISOString(),
    })
    .eq("id", leadId)
    .eq("space_id", spaceId);

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidatePath("/admin/leads");
  return { success: true as const };
}
