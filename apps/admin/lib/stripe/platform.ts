import "server-only";
import { getStripe } from "./client";

export async function getPlatformBalance() {
  const stripe = getStripe();
  return stripe.balance.retrieve();
}

export async function getApplicationFees(limit = 20) {
  const stripe = getStripe();
  return stripe.applicationFees.list({ limit });
}

export async function getApplicationFeesSummary(days = 30) {
  const stripe = getStripe();
  const since = Math.floor(Date.now() / 1000) - days * 86400;

  const transactions = await stripe.balanceTransactions.list({
    type: "application_fee",
    created: { gte: since },
    limit: 100,
  });

  let totalFeeCents = 0;
  for (const tx of transactions.data) {
    totalFeeCents += tx.amount;
  }

  return {
    totalFeeCents,
    count: transactions.data.length,
    transactions: transactions.data,
  };
}

export async function getConnectedAccountDetails(accountId: string) {
  const stripe = getStripe();
  return stripe.accounts.retrieve(accountId);
}

export async function getPaymentVolume(days = 30) {
  const stripe = getStripe();
  const since = Math.floor(Date.now() / 1000) - days * 86400;

  const charges = await stripe.charges.list({
    created: { gte: since },
    limit: 100,
  });

  let totalVolumeCents = 0;
  let successCount = 0;
  let failedCount = 0;

  for (const charge of charges.data) {
    if (charge.status === "succeeded") {
      totalVolumeCents += charge.amount;
      successCount++;
    } else if (charge.status === "failed") {
      failedCount++;
    }
  }

  return { totalVolumeCents, successCount, failedCount };
}
