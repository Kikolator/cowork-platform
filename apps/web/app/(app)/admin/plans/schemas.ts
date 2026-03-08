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
  sortOrder: z.number().int(),
  creditConfig: z.array(
    z.object({
      resourceTypeId: z.string().uuid(),
      monthlyMinutes: z.number().int().min(0),
      isUnlimited: z.boolean(),
    })
  ),
});

export type PlanFormValues = z.infer<typeof planSchema>;
