import { z } from "zod";

export const availabilityQuerySchema = z
  .object({
    type: z.enum(["daypass", "membership"]),
    plan_slug: z.string().optional(),
  })
  .refine((d) => d.type !== "membership" || d.plan_slug, {
    message: "plan_slug is required for membership availability checks",
  });

export const checkoutSessionSchema = z
  .object({
    type: z.enum(["daypass", "membership"]),
    email: z.string().email("A valid email is required"),
    name: z.string().optional(),
    plan_slug: z.string().optional(),
  })
  .refine((d) => d.type !== "membership" || d.plan_slug, {
    message: "plan_slug is required for membership checkout",
  });

export const resendMagicLinkSchema = z.object({
  session_id: z.string().min(1, "session_id is required"),
});

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
export type CheckoutSessionBody = z.infer<typeof checkoutSessionSchema>;
export type ResendMagicLinkBody = z.infer<typeof resendMagicLinkSchema>;
