import { z } from "zod";

export const LEAD_STATUSES = [
  "new",
  "invited",
  "confirmed",
  "completed",
  "follow_up",
  "converted",
  "lost",
] as const;

export const LEAD_SOURCES = [
  "website",
  "manual",
  "referral",
  "walk_in",
  "event",
  "officernd_import",
] as const;

export const leadSchema = z.object({
  email: z.string().email(),
  fullName: z.string().max(200).optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  company: z.string().max(200).optional().or(z.literal("")),
  status: z.enum(LEAD_STATUSES).default("new"),
  source: z.enum(LEAD_SOURCES).default("website"),
  trialDate: z.string().optional().or(z.literal("")),
  trialConfirmed: z.boolean().default(false),
  adminNotes: z.string().max(5000).optional().or(z.literal("")),
});

export type LeadFormValues = z.input<typeof leadSchema>;
