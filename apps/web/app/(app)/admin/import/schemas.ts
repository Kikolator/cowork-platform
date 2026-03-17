import { z } from "zod";
import { slugify } from "@/lib/csv";

/** Normalize empty strings to undefined for optional fields */
const optionalString = z
  .string()
  .transform((v) => (v.trim() === "" ? undefined : v.trim()))
  .optional();

// ── Date & price helpers ────────────────────────────────────────────

const SPANISH_MONTHS: Record<string, number> = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
};

/**
 * Parse dates in Spanish locale format ("26 de mar. de 2026 15:00")
 * with ISO fallback. Returns ISO string or null if unparseable.
 */
export function parseLocalizedDate(input: string): string | null {
  // Try ISO / standard Date parsing first
  const standard = new Date(input);
  if (!isNaN(standard.getTime())) return standard.toISOString();

  // Try Spanish locale: "26 de mar. de 2026 15:00" or "26 de mar. de 2026"
  const match = input.match(
    /(\d{1,2})\s+de\s+(\w{3})\.?\s+de\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/,
  );
  if (!match) return null;

  const [, day, monthStr, year, hours, minutes] = match;
  const month = SPANISH_MONTHS[monthStr.toLowerCase()];
  if (month === undefined) return null;

  const date = new Date(
    parseInt(year),
    month,
    parseInt(day),
    hours ? parseInt(hours) : 0,
    minutes ? parseInt(minutes) : 0,
  );
  return isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Parse price strings to cents. Handles:
 * - Plain numbers: "35" → 3500
 * - Currency + comma decimal: "€11,50 / hour" → 1150
 */
export function parsePriceToCents(input: string): number {
  // Strip currency symbols and rate suffixes like "/ hour", "/ day"
  const cleaned = input.replace(/[€$£]/g, "").replace(/\/.*$/, "").trim();
  // Handle comma as decimal separator (European format)
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  return Math.round(parseFloat(normalized) * 100) || 0;
}

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
    price: optionalString,
    currency: optionalString,
    external_id: optionalString,
  })
  .transform((data) => ({
    name: data.name,
    slug: slugify(data.name),
    description: data.description,
    price_cents: data.price ? parsePriceToCents(data.price) : 0,
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
    vat: optionalString,
    reg_number: optionalString,
    address: optionalString,
    city: optionalString,
    zip: optionalString,
    country: optionalString,
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
      joined_at: data.joined_at ? parseLocalizedDate(data.joined_at) : undefined,
      vat: data.vat,
      reg_number: data.reg_number,
      address: data.address,
      city: data.city,
      zip: data.zip,
      country: data.country,
      external_id: data.external_id,
    };
  });

export type ImportMember = z.infer<typeof importMemberSchema>;

export const importBookingSchema = z
  .object({
    resource_name: z.string().min(1, "Resource name is required"),
    member_email: optionalString,
    member_name: optionalString,
    start_time: z.string().min(1, "Start time is required"),
    end_time: z.string().min(1, "End time is required"),
    status: optionalString,
    external_id: optionalString,
  })
  .refine((data) => data.member_email || data.member_name, {
    message: "Either member email or member name is required",
  })
  .transform((data) => {
    const startIso = parseLocalizedDate(data.start_time);
    const endIso = parseLocalizedDate(data.end_time);
    const endDate = endIso ? new Date(endIso) : new Date();
    const isHistorical = endDate < new Date();

    return {
      resource_name: data.resource_name,
      member_email: data.member_email?.toLowerCase().trim(),
      member_name: data.member_name,
      start_time: startIso ?? data.start_time,
      end_time: endIso ?? data.end_time,
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

// ── Teams schema (used for billing merge, not a wizard entity) ──────

export const importTeamSchema = z
  .object({
    name: z.string().min(1, "Team name is required"),
    business_name: optionalString,
    vat: optionalString,
    reg_number: optionalString,
    email: optionalString,
    address: optionalString,
    city: optionalString,
    state: optionalString,
    zip: optionalString,
    country: optionalString,
    billing_address: optionalString,
    billing_city: optionalString,
    billing_state: optionalString,
    billing_zip: optionalString,
    billing_country: optionalString,
  })
  .transform((data) => ({
    ...data,
    // Prefer billing address fields, fall back to primary address
    resolved_billing_address: data.billing_address ?? data.address,
    resolved_billing_city: data.billing_city ?? data.city,
    resolved_billing_state: data.billing_state ?? data.state,
    resolved_billing_zip: data.billing_zip ?? data.zip,
    resolved_billing_country: data.billing_country ?? data.country,
  }));

export type ImportTeam = z.infer<typeof importTeamSchema>;

// ── Status normalizers ──────────────────────────────────────────────

function normalizeResourceStatus(
  status: string | undefined,
): "available" | "occupied" | "out_of_service" {
  if (!status) return "available";
  const lower = status.toLowerCase();
  if (lower.includes("out") || lower.includes("service"))
    return "out_of_service";
  if (lower.includes("occupied") || lower.includes("busy")) return "occupied";
  // OfficeRnd desk types that are really "available"
  if (lower === "hotdesk" || lower === "daypass_desk" || lower === "desk_tr")
    return "available";
  return "available";
}

function normalizeMemberStatus(
  status: string | undefined,
): "active" | "paused" | "churned" {
  if (!status) return "active";
  const lower = status.toLowerCase();
  if (lower.includes("pause") || lower.includes("suspend")) return "paused";
  if (
    lower === "former" ||
    lower === "left" ||
    lower.includes("churn") ||
    lower.includes("cancel") ||
    lower.includes("inactive")
  )
    return "churned";
  // lead, contact, drop-in, not_approved → active
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
): "new" | "invited" | "confirmed" | "completed" | "follow_up" | "converted" | "lost" {
  if (!status) return "new";
  const lower = status.toLowerCase();
  // Check specific OfficeRnd statuses first
  if (lower === "trial complete" || lower.includes("complete")) return "completed";
  if (lower.includes("follow up") || lower.includes("follow_up")) return "follow_up";
  if (lower === "trial request" || lower === "phone confirmation") return "invited";
  if (lower === "contact") return "new";
  if (lower.includes("invite")) return "invited";
  if (lower.includes("confirm") || lower.includes("active")) return "confirmed";
  if (lower.includes("convert") || lower.includes("won")) return "converted";
  if (lower.includes("lost") || lower.includes("closed")) return "lost";
  return "new";
}
