import "server-only";
import { getStripe } from "./client";

/**
 * Create a percent-off coupon on a connected account for a referred member's checkout.
 * Returns the Stripe coupon ID.
 */
export async function createReferralCoupon(params: {
  percentOff: number;
  durationMonths: number;
  connectedAccountId: string;
  spaceId: string;
  referralId: string;
}): Promise<string> {
  const coupon = await getStripe().coupons.create(
    {
      percent_off: params.percentOff,
      duration: params.durationMonths === 1 ? "once" : "repeating",
      ...(params.durationMonths > 1 && {
        duration_in_months: params.durationMonths,
      }),
      metadata: {
        space_id: params.spaceId,
        referral_id: params.referralId,
        type: "referral_referred",
      },
    },
    { stripeAccount: params.connectedAccountId },
  );

  return coupon.id;
}

/**
 * Create a percent-off coupon and apply it to an existing subscription
 * (for rewarding the referrer with a discount).
 * Returns the Stripe coupon ID.
 */
export async function applyReferrerDiscountCoupon(params: {
  percentOff: number;
  durationMonths: number;
  subscriptionId: string;
  connectedAccountId: string;
  spaceId: string;
  referralId: string;
}): Promise<string> {
  const coupon = await getStripe().coupons.create(
    {
      percent_off: params.percentOff,
      duration: params.durationMonths === 1 ? "once" : "repeating",
      ...(params.durationMonths > 1 && {
        duration_in_months: params.durationMonths,
      }),
      metadata: {
        space_id: params.spaceId,
        referral_id: params.referralId,
        type: "referral_referrer",
      },
    },
    { stripeAccount: params.connectedAccountId },
  );

  await getStripe().subscriptions.update(
    params.subscriptionId,
    { discounts: [{ coupon: coupon.id }] },
    { stripeAccount: params.connectedAccountId },
  );

  return coupon.id;
}
