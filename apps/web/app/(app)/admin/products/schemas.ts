import { z } from "zod";

const CATEGORIES = ["pass", "hour_bundle", "addon", "deposit", "event"] as const;

const PURCHASE_FLOW_MAP: Record<string, string> = {
  pass: "date_picker",
  addon: "subscription_addon",
  hour_bundle: "checkout",
  deposit: "checkout",
  event: "checkout",
} as const;

export function purchaseFlowForCategory(category: string): string {
  return PURCHASE_FLOW_MAP[category] ?? "checkout";
}

const creditGrantConfigSchema = z.object({
  resourceTypeId: z.string().uuid(),
  minutes: z.number().int().min(1),
});

const visibilityRulesSchema = z.object({
  requireMembership: z.boolean().optional(),
  requireNoMembership: z.boolean().optional(),
  requirePlanIds: z.array(z.string().uuid()).optional(),
  excludeUnlimited: z.boolean().optional(),
});

export const productSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
  description: z.string().max(500).optional().or(z.literal("")),
  category: z.enum(CATEGORIES),
  priceCents: z.number().int().min(0),
  currency: z.string().length(3),
  ivaRate: z.number().min(0).max(100),
  planId: z.string().uuid().optional().or(z.literal("")),
  creditGrantConfig: creditGrantConfigSchema.optional(),
  visibilityRules: visibilityRulesSchema,
  sortOrder: z.number().int(),
  active: z.boolean(),
});

export type ProductFormValues = z.infer<typeof productSchema>;
