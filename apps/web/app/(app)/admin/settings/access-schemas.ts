import { z } from "zod";

export const accessConfigSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(["manual", "nuki"]),
  codeBusinessHours: z.string().nullable(),
  codeExtended: z.string().nullable(),
  codeTwentyFourSeven: z.string().nullable(),
  nukiApiToken: z.string().nullable(),
  nukiSmartlockId: z.string().nullable(),
});

export type AccessConfigValues = z.infer<typeof accessConfigSchema>;
