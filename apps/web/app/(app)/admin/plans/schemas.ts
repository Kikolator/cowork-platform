import { z } from "zod";

export const planSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
  description: z.string().max(500).optional().or(z.literal("")),
  priceCents: z.number().int().min(0),
  currency: z.string().length(3),
  ivaRate: z.number().min(0).max(100),
  accessType: z.enum(["none", "business_hours", "extended", "twenty_four_seven"]),
  hasFixedDesk: z.boolean(),
  membersPerDesk: z.number().int().min(0).max(100),
  sortOrder: z.number().int(),
  creditConfig: z.array(
    z.object({
      resourceTypeId: z.string().uuid(),
      monthlyMinutes: z.number().int().min(0),
      isUnlimited: z.boolean(),
    })
  ),
});

/** Convert members-per-desk (admin input) to desk_weight (DB column). 0 means no desk needed. */
export function membersPerDeskToWeight(membersPerDesk: number): number {
  if (membersPerDesk <= 0) return 0;
  return Math.round((1 / membersPerDesk) * 10000) / 10000;
}

/** Convert desk_weight (DB column) to members-per-desk (admin display). */
export function weightToMembersPerDesk(weight: number): number {
  if (weight <= 0) return 0;
  return Math.round(1 / weight);
}

export type PlanFormValues = z.infer<typeof planSchema>;
