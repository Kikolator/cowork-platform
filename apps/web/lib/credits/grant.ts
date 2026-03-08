import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Grant monthly credits for a member based on their plan's credit config.
 * Called from invoice.paid webhook handler.
 */
export async function grantMonthlyCredits(params: {
  spaceId: string;
  userId: string;
  planId: string;
  stripeInvoiceId: string;
  validUntil: Date;
}) {
  const admin = createAdminClient();

  const { data: configs } = await admin
    .from("plan_credit_config")
    .select("resource_type_id, monthly_minutes, is_unlimited")
    .eq("plan_id", params.planId);

  if (!configs) return;

  for (const config of configs) {
    if (config.is_unlimited) continue;
    if (config.monthly_minutes === 0) continue;

    await admin.rpc("grant_credits", {
      p_space_id: params.spaceId,
      p_user_id: params.userId,
      p_resource_type_id: config.resource_type_id,
      p_amount_minutes: config.monthly_minutes,
      p_source: "subscription",
      p_valid_from: new Date().toISOString(),
      p_valid_until: params.validUntil.toISOString(),
      p_stripe_invoice_id: params.stripeInvoiceId,
    });
  }
}

/**
 * Expire all renewable (subscription) credits for a member.
 * Called on cancellation and before monthly renewal.
 */
export async function expireRenewableCredits(params: {
  spaceId: string;
  userId: string;
}) {
  const admin = createAdminClient();

  await admin.rpc("expire_renewable_credits", {
    p_space_id: params.spaceId,
    p_user_id: params.userId,
  });
}
