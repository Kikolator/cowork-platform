"use server";

import { revalidatePath } from "next/cache";
import { createLogger } from "@cowork/shared";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function getAdminContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const spaceId = user.app_metadata?.space_id as string | undefined;
  if (!spaceId) throw new Error("No space context");
  return { user, spaceId };
}

export async function cancelPass(
  passId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { spaceId } = await getAdminContext();
    const admin = createAdminClient();

    const { data: pass } = await admin
      .from("passes")
      .select("id, status, space_id")
      .eq("id", passId)
      .eq("space_id", spaceId)
      .single();

    if (!pass) return { success: false, error: "Pass not found" };
    // "upcoming" not yet in generated types
    if (pass.status !== "active" && (pass.status as string) !== "upcoming") {
      return { success: false, error: "Only active or upcoming passes can be cancelled" };
    }

    await admin
      .from("passes")
      .update({
        status: "cancelled",
        assigned_desk_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", passId);

    revalidatePath("/admin/passes");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Something went wrong",
    };
  }
}

export async function createManualPass(
  userId: string,
  passType: "day" | "week",
  startDate: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { spaceId } = await getAdminContext();
    const admin = createAdminClient();

    let endDate = startDate;
    if (passType === "week") {
      const start = new Date(startDate);
      start.setDate(start.getDate() + 4);
      endDate = start.toISOString().split("T")[0]!;
    }

    // Create pass
    const { data: pass, error: insertError } = await admin
      .from("passes")
      .insert({
        space_id: spaceId,
        user_id: userId,
        pass_type: passType,
        status: "active",
        start_date: startDate,
        end_date: endDate,
        amount_cents: 0,
      })
      .select("id")
      .single();

    if (insertError || !pass) {
      return { success: false, error: "Failed to create pass" };
    }

    // Auto-assign desk
    const { data: deskId, error: deskError } = await admin.rpc("auto_assign_desk", {
      p_space_id: spaceId,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (deskError) {
      createLogger({ component: "passes/actions", spaceId }).error("auto_assign_desk RPC failed", { error: deskError.message, passId: pass.id });
    } else if (deskId) {
      await admin
        .from("passes")
        .update({ assigned_desk_id: deskId })
        .eq("id", pass.id);
    }

    revalidatePath("/admin/passes");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Something went wrong",
    };
  }
}
