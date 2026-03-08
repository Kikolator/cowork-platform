import { z } from "zod";

export const brandingSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
  logoUrl: z.string().url().optional().or(z.literal("")),
  faviconUrl: z.string().url().optional().or(z.literal("")),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color"),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color"),
});

export type BrandingFormValues = z.infer<typeof brandingSchema>;

export const operationsSchema = z.object({
  timezone: z.string().min(1),
  currency: z.string().length(3),
  defaultLocale: z.enum(["en", "es", "de", "fr", "pt", "nl"]),
  businessHours: z.record(
    z.string(),
    z.union([
      z.object({ open: z.string(), close: z.string() }),
      z.null(),
    ])
  ),
});

export type OperationsFormValues = z.infer<typeof operationsSchema>;

export const fiscalSchema = z.object({
  requireFiscalId: z.boolean(),
  supportedFiscalIdTypes: z.array(z.string()).min(1, "Select at least one fiscal ID type"),
});

export type FiscalFormValues = z.infer<typeof fiscalSchema>;
