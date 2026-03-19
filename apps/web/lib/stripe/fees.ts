import "server-only";

/** Default platform fee percentage by plan tier */
const PLAN_FEE_DEFAULTS = {
  free: 5,
  pro: 3,
  enterprise: 1,
} as const;

type PlatformPlan = keyof typeof PLAN_FEE_DEFAULTS;

/**
 * Resolve the effective platform fee percent for a tenant.
 * Per-tenant override takes precedence; otherwise falls back to plan default.
 */
export function getEffectiveFeePercent(
  platformPlan: string,
  override: number | null,
): number {
  if (override !== null && override !== undefined) return override;
  return (
    PLAN_FEE_DEFAULTS[platformPlan as PlatformPlan] ?? PLAN_FEE_DEFAULTS.free
  );
}

/**
 * Calculate the platform application fee for a given amount.
 * Returns fee in cents.
 */
export function calculateApplicationFee(
  amountCents: number,
  feePercent: number,
): number {
  return Math.round(amountCents * (feePercent / 100));
}
