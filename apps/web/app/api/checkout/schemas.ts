import { z } from "zod";

export const availabilityQuerySchema = z
  .object({
    type: z.enum(["daypass", "product", "membership"]),
    plan_slug: z.string().optional(),
    product_slug: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD").optional(),
    email: z.string().email().optional(),
  })
  .refine((d) => d.type !== "membership" || d.plan_slug, {
    message: "plan_slug is required for membership availability checks",
  })
  .refine((d) => d.type !== "product" || (d.product_slug && d.date), {
    message: "product_slug and date are required for product availability checks",
  });

export const checkoutSessionSchema = z
  .object({
    type: z.enum(["daypass", "product", "membership"]),
    email: z.string().email("A valid email is required"),
    name: z.string().optional(),
    plan_slug: z.string().optional(),
    product_slug: z.string().optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "start_date must be YYYY-MM-DD").optional(),
    community_rules_accepted: z.boolean().optional(),
  })
  .refine((d) => d.type !== "membership" || d.plan_slug, {
    message: "plan_slug is required for membership checkout",
  })
  .refine((d) => d.type !== "product" || (d.product_slug && d.start_date), {
    message: "product_slug and start_date are required for product checkout",
  });

export const resendMagicLinkSchema = z.object({
  session_id: z.string().min(1, "session_id is required"),
});

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
export type CheckoutSessionBody = z.infer<typeof checkoutSessionSchema>;
export type ResendMagicLinkBody = z.infer<typeof resendMagicLinkSchema>;
