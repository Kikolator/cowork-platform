import { z } from "zod";

const MEMBER_STATUSES = ["active", "paused", "past_due", "cancelling", "churned"] as const;
const BILLING_ENTITY_TYPES = ["individual", "company"] as const;
const FISCAL_ID_TYPES = ["nif", "nie", "cif", "passport", "eu_vat", "foreign_tax_id", "other"] as const;
const NOTE_CATEGORIES = ["general", "billing", "access", "incident", "support"] as const;

// Client-side schema (used by react-hook-form) — lenient, no transforms
export const updateMemberSchema = z.object({
  planId: z.string().uuid(),
  status: z.enum(MEMBER_STATUSES),
  fixedDeskId: z.string().nullable(),
  hasTwentyFourSeven: z.boolean(),
  accessCode: z.string().nullable(),
  alarmApproved: z.boolean(),
  company: z.string().nullable(),
  roleTitle: z.string().nullable(),
  billingEntityType: z.enum(BILLING_ENTITY_TYPES),
  fiscalIdType: z.string().nullable(),
  fiscalId: z.string().nullable(),
  billingCompanyName: z.string().nullable(),
  billingCompanyTaxIdType: z.string().nullable(),
  billingCompanyTaxId: z.string().nullable(),
  billingAddressLine1: z.string().nullable(),
  billingAddressLine2: z.string().nullable(),
  billingCity: z.string().nullable(),
  billingPostalCode: z.string().nullable(),
  billingStateProvince: z.string().nullable(),
  billingCountry: z.string().nullable(),
});

export const addMemberNoteSchema = z.object({
  memberId: z.string().uuid(),
  content: z.string().min(1, "Note cannot be empty").max(2000),
  category: z.enum(NOTE_CATEGORIES),
});

export const addMemberSchema = z.object({
  email: z.string().email("Valid email required"),
  fullName: z.string().max(200).optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  planId: z.string().uuid("Select a plan"),
  company: z.string().max(200).optional().or(z.literal("")),
  sendInvite: z.boolean(),
});

export const sendInviteSchema = z.object({
  memberId: z.string().uuid(),
});

export const sendBulkInvitesSchema = z.object({
  memberIds: z.array(z.string().uuid()).min(1, "Select at least one member"),
});

export type UpdateMemberValues = z.infer<typeof updateMemberSchema>;
export type AddMemberNoteValues = z.infer<typeof addMemberNoteSchema>;
export type AddMemberValues = z.infer<typeof addMemberSchema>;
