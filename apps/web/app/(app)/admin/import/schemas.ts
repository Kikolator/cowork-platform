import { z } from "zod";
import { slugify } from "@/lib/csv";

/** Normalize empty strings to undefined for optional fields */
const optionalString = z
  .string()
  .transform((v) => (v.trim() === "" ? undefined : v.trim()))
  .optional();

export const importResourceTypeSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    slug: optionalString,
    external_id: optionalString,
  })
  .transform((data) => ({
    ...data,
    slug: data.slug || slugify(data.name),
  }));

export type ImportResourceType = z.infer<typeof importResourceTypeSchema>;

export const importResourceSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    resource_type_name: optionalString,
    floor: optionalString,
    capacity: optionalString,
    status: optionalString,
    external_id: optionalString,
  })
  .transform((data) => ({
    name: data.name,
    resource_type_name: data.resource_type_name,
    floor: data.floor ? parseInt(data.floor, 10) || 0 : 0,
    capacity: data.capacity ? parseInt(data.capacity, 10) || 1 : 1,
    status: normalizeResourceStatus(data.status),
    external_id: data.external_id,
  }));

export type ImportResource = z.infer<typeof importResourceSchema>;

export const importPlanSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    description: optionalString,
    price: z.string().min(1, "Price is required"),
    currency: optionalString,
    external_id: optionalString,
  })
  .transform((data) => ({
    name: data.name,
    slug: slugify(data.name),
    description: data.description,
    price_cents: Math.round(parseFloat(data.price) * 100) || 0,
    currency: data.currency?.toLowerCase() || "eur",
    external_id: data.external_id,
  }));

export type ImportPlan = z.infer<typeof importPlanSchema>;

export const importMemberSchema = z
  .object({
    email: z.string().email("Valid email is required"),
    full_name: optionalString,
    first_name: optionalString,
    last_name: optionalString,
    company: optionalString,
    phone: optionalString,
    plan_name: optionalString,
    status: optionalString,
    joined_at: optionalString,
    external_id: optionalString,
  })
  .transform((data) => {
    const fullName =
      data.full_name ||
      [data.first_name, data.last_name].filter(Boolean).join(" ") ||
      undefined;
    return {
      email: data.email.toLowerCase().trim(),
      full_name: fullName,
      company: data.company,
      phone: data.phone,
      plan_name: data.plan_name,
      status: normalizeMemberStatus(data.status),
      joined_at: data.joined_at,
      external_id: data.external_id,
    };
  });

export type ImportMember = z.infer<typeof importMemberSchema>;

export const importBookingSchema = z
  .object({
    resource_name: z.string().min(1, "Resource name is required"),
    member_email: z.string().email("Valid member email is required"),
    member_name: optionalString,
    start_time: z.string().min(1, "Start time is required"),
    end_time: z.string().min(1, "End time is required"),
    status: optionalString,
    external_id: optionalString,
  })
  .transform((data) => {
    const startDate = new Date(data.start_time);
    const endDate = new Date(data.end_time);
    const isHistorical = endDate < new Date();

    return {
      resource_name: data.resource_name,
      member_email: data.member_email.toLowerCase().trim(),
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      status: isHistorical
        ? ("completed" as const)
        : normalizeBookingStatus(data.status),
      is_historical: isHistorical,
      external_id: data.external_id,
    };
  });

export type ImportBooking = z.infer<typeof importBookingSchema>;

export const importLeadSchema = z
  .object({
    email: z.string().email("Valid email is required"),
    full_name: optionalString,
    company: optionalString,
    phone: optionalString,
    status: optionalString,
    admin_notes: optionalString,
    external_id: optionalString,
  })
  .transform((data) => ({
    email: data.email.toLowerCase().trim(),
    full_name: data.full_name,
    company: data.company,
    phone: data.phone,
    status: normalizeLeadStatus(data.status),
    admin_notes: data.admin_notes,
    source: "officernd_import" as const,
    external_id: data.external_id,
  }));

export type ImportLead = z.infer<typeof importLeadSchema>;

// ── Status normalizers ──────────────────────────────────────────────

function normalizeResourceStatus(
  status: string | undefined,
): "available" | "occupied" | "out_of_service" {
  if (!status) return "available";
  const lower = status.toLowerCase();
  if (lower.includes("out") || lower.includes("service"))
    return "out_of_service";
  if (lower.includes("occupied") || lower.includes("busy")) return "occupied";
  return "available";
}

function normalizeMemberStatus(
  status: string | undefined,
): "active" | "paused" | "churned" {
  if (!status) return "active";
  const lower = status.toLowerCase();
  if (lower.includes("pause") || lower.includes("suspend")) return "paused";
  if (
    lower.includes("churn") ||
    lower.includes("cancel") ||
    lower.includes("inactive")
  )
    return "churned";
  return "active";
}

function normalizeBookingStatus(
  status: string | undefined,
): "confirmed" | "cancelled" {
  if (!status) return "confirmed";
  const lower = status.toLowerCase();
  if (lower.includes("cancel")) return "cancelled";
  return "confirmed";
}

function normalizeLeadStatus(
  status: string | undefined,
): "new" | "invited" | "confirmed" | "converted" | "lost" {
  if (!status) return "new";
  const lower = status.toLowerCase();
  if (lower.includes("invite")) return "invited";
  if (lower.includes("confirm") || lower.includes("active")) return "confirmed";
  if (lower.includes("convert") || lower.includes("won")) return "converted";
  if (lower.includes("lost") || lower.includes("closed")) return "lost";
  return "new";
}
