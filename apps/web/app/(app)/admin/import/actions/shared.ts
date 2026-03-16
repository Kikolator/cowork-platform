"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ImportResult {
  inserted: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

export async function getAdminContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const spaceId = user.app_metadata?.space_id as string | undefined;
  if (!spaceId) throw new Error("No space context");
  return { supabase, user, spaceId, admin: createAdminClient() };
}

export async function createImportJob(): Promise<
  { success: true; jobId: string } | { success: false; error: string }
> {
  try {
    const { admin, user, spaceId } = await getAdminContext();
    const { data, error } = await admin
      .from("import_jobs")
      .insert({
        space_id: spaceId,
        admin_id: user.id,
        source: "officernd",
        status: "in_progress",
      })
      .select("id")
      .single();

    if (error || !data) {
      return { success: false, error: error?.message ?? "Failed to create import job" };
    }
    return { success: true, jobId: data.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function completeImportJob(
  jobId: string,
  summary: Record<string, ImportResult>,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { admin, spaceId } = await getAdminContext();
    const { error } = await admin
      .from("import_jobs")
      .update({
        status: "completed",
        summary: JSON.parse(JSON.stringify(summary)),
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .eq("space_id", spaceId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
