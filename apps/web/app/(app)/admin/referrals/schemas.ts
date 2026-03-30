import { z } from "zod";

export const referralProgramSchema = z.object({
  active: z.boolean(),
  referrerRewardType: z.enum(["credit", "discount", "none"]),
  referrerCreditMinutes: z.coerce.number().int().positive().nullable(),
  referrerCreditResourceTypeId: z.string().uuid().nullable(),
  referrerDiscountPercent: z.coerce.number().int().min(1).max(100).nullable(),
  referrerDiscountMonths: z.coerce.number().int().min(1).max(12).nullable(),
  referredDiscountPercent: z.coerce.number().int().min(0).max(100),
  referredDiscountMonths: z.coerce.number().int().min(1).max(12),
  maxReferralsPerMember: z.coerce.number().int().positive().nullable(),
  maxReferralsTotal: z.coerce.number().int().positive().nullable(),
  codeExpiryDays: z.coerce.number().int().positive().nullable(),
});

export type ReferralProgramInput = z.infer<typeof referralProgramSchema>;
