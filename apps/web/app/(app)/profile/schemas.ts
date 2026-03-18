import { z } from "zod";

const PREFERRED_LANGS = ["en", "es", "de", "fr", "pt", "nl"] as const;
const BILLING_ENTITY_TYPES = ["individual", "company"] as const;
const PREFERRED_CHANNELS = ["email", "push", "sms"] as const;

export const personalProfileSchema = z.object({
  fullName: z.string().max(200).nullable(),
  phone: z.string().max(50).nullable(),
  avatarUrl: z.string().url().or(z.literal("")).nullable(),
  preferredLang: z.enum(PREFERRED_LANGS),
});

export const professionalBillingSchema = z.object({
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

export const notificationsSchema = z.object({
  bookingReminders: z.boolean(),
  creditWarnings: z.boolean(),
  marketing: z.boolean(),
  weeklySummary: z.boolean(),
  preferredChannel: z.enum(PREFERRED_CHANNELS),
});

export type PersonalProfileValues = z.infer<typeof personalProfileSchema>;
export type ProfessionalBillingValues = z.infer<typeof professionalBillingSchema>;
export type NotificationsValues = z.infer<typeof notificationsSchema>;
