import "server-only";
import { getStripe } from "./client";

export interface PlatformFeeRow {
  id: string;
  amount: number;
  currency: string;
  accountId: string;
  accountName: string | null;
  chargeId: string | null;
  date: number;
}

/**
 * List application fees collected by the platform with account details.
 */
export async function listApplicationFees(
  limit = 100,
): Promise<PlatformFeeRow[]> {
  const stripe = getStripe();
  const fees = await stripe.applicationFees.list({
    limit,
    expand: ["data.account"],
  });

  return fees.data.map((fee) => {
    const account =
      typeof fee.account === "string"
        ? { id: fee.account, business_profile: null }
        : fee.account;

    return {
      id: fee.id,
      amount: fee.amount,
      currency: fee.currency,
      accountId: account.id,
      accountName: account.business_profile?.name ?? null,
      chargeId: typeof fee.charge === "string" ? fee.charge : fee.charge?.id ?? null,
      date: fee.created,
    };
  });
}
