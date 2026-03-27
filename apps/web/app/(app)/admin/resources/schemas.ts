import { z } from "zod";

export const resourceSchema = z.object({
  name: z.string().min(1).max(100),
  resourceTypeId: z.string().uuid(),
  capacity: z.number().int().min(1).max(1000),
  floor: z.number().int().min(-5).max(100),
  sortOrder: z.number().int(),
  imageUrl: z.string().url().nullable().optional(),
});

export type ResourceFormValues = z.infer<typeof resourceSchema>;

export const resourceTypeSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers, and underscores only"),
  bookable: z.boolean(),
  billable: z.boolean(),
  defaultRateCents: z.number().int().min(0).optional(),
});

export type ResourceTypeFormValues = z.infer<typeof resourceTypeSchema>;
