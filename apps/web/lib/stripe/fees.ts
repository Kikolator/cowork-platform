import "server-only";

const PLATFORM_FEE_PERCENT = parseInt(
  process.env.STRIPE_PLATFORM_FEE_PERCENT ?? "3",
  10,
);

/**
 * Calculate the platform application fee for a given amount.
 * Returns fee in cents.
 */
export function calculateApplicationFee(amountCents: number): number {
  return Math.round(amountCents * (PLATFORM_FEE_PERCENT / 100));
}
