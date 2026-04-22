"use server";

import { revalidatePath } from "next/cache";
import { createLogger } from "@cowork/shared";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refundPassPayment } from "@/lib/stripe/refunds";

/**
 * Self-service pass cancellation with refund.
 * Only allowed for upcoming passes within the cancellation policy window.
 */
export async function cancelOwnPass(
  passId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const spaceId = user.app_metadata?.space_id as string | undefined;
    if (!spaceId) return { success: false, error: "No space context" };

    const admin = createAdminClient();
    const logger = createLogger({ component: "passes/self-cancel", spaceId });

    // Fetch pass and verify ownership
    const { data: pass } = await admin
      .from("passes")
      .select("id, user_id, status, start_date, stripe_session_id, amount_cents, space_id")
      .eq("id", passId)
      .eq("space_id", spaceId)
      .single();

    if (!pass) return { success: false, error: "Pass not found" };
    if (pass.user_id !== user.id) {
      return { success: false, error: "You can only cancel your own passes" };
    }
    if ((pass.status as string) !== "upcoming") {
      return { success: false, error: "Only upcoming passes can be cancelled" };
    }

    // Check cancellation policy
    const { data: space } = await admin
      .from("spaces")
      .select("*") // includes tenant_id, pass_cancel_before_hours (some not yet in generated types)
      .eq("id", spaceId)
      .single();

    if (!space) return { success: false, error: "Space not found" };

    const cancelBeforeHours = ((space as Record<string, unknown>)
      .pass_cancel_before_hours as number | null) ?? 24;

    const startTime = new Date(pass.start_date + "T00:00:00Z").getTime();
    const now = Date.now();
    const hoursUntilStart = (startTime - now) / (1000 * 60 * 60);

    if (hoursUntilStart < cancelBeforeHours) {
      return {
        success: false,
        error: `Cancellation must be at least ${cancelBeforeHours} hours before the pass start date`,
      };
    }

    // Issue refund if paid
    let refundId: string | undefined;
    let amountRefunded = 0;

    if (pass.stripe_session_id) {
      const { data: tenant } = await admin
        .from("tenants")
        .select("stripe_account_id")
        .eq("id", space.tenant_id)
        .single();

      if (!tenant?.stripe_account_id) {
        return { success: false, error: "Refund cannot be processed. Please contact space support." };
      }

      const result = await refundPassPayment({
        stripeSessionId: pass.stripe_session_id,
        connectedAccountId: tenant.stripe_account_id,
      });
      refundId = result.refundId;
      amountRefunded = result.amountRefunded;
    }

    // Update pass
    const updateData = {
      status: "cancelled" as const,
      assigned_desk_id: null,
      updated_at: new Date().toISOString(),
    };
    Object.assign(updateData, {
      cancellation_reason: "user_request",
      ...(refundId
        ? {
            refunded_at: new Date().toISOString(),
            refund_amount_cents: amountRefunded,
            stripe_refund_id: refundId,
          }
        : {}),
    });

    await admin
      .from("passes")
      .update(updateData)
      .eq("id", passId);

    logger.info("Self-service pass cancelled", { passId, refundId, amountRefunded });
    revalidatePath("/passes");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Cancellation failed",
    };
  }
}
