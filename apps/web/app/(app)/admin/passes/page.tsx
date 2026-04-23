import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { PassesTable } from "./passes-table";

export default async function AdminPassesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const spaceId = user.app_metadata?.space_id as string | undefined;
  if (!spaceId) redirect("/login");

  // Fetch passes with desk info (desk has a proper FK)
  const { data: passes } = await supabase
    .from("passes")
    .select(
      "id, user_id, pass_type, status, start_date, end_date, amount_cents, is_guest, purchased_by, stripe_session_id, assigned_desk_id, created_at, desk:resources!passes_assigned_desk_id_fkey(name)",
    )
    .eq("space_id", spaceId)
    .order("created_at", { ascending: false });

  // Collect unique user IDs to fetch profiles
  const userIds = new Set<string>();
  for (const pass of passes ?? []) {
    userIds.add(pass.user_id);
    if (pass.purchased_by) userIds.add(pass.purchased_by);
  }

  // Fetch profiles and all space users via admin client
  const admin = createAdminClient();
  const [profilesResult, spaceUsersResult] = await Promise.all([
    userIds.size > 0
      ? admin
          .from("shared_profiles")
          .select("id, full_name, email")
          .in("id", Array.from(userIds))
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; email: string }> }),
    admin
      .from("space_users")
      .select("user_id")
      .eq("space_id", spaceId)
      .then(async (res) => {
        if (!res.data?.length) return [];
        const ids = res.data.map((su) => su.user_id);
        const { data } = await admin
          .from("shared_profiles")
          .select("id, full_name, email")
          .in("id", ids)
          .order("full_name", { ascending: true });
        return data ?? [];
      }),
  ]);
  const profiles = profilesResult.data ?? [];

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, { full_name: p.full_name, email: p.email }]),
  );

  const passesWithProfiles = (passes ?? []).map((pass) => ({
    id: pass.id,
    pass_type: pass.pass_type,
    status: pass.status,
    start_date: pass.start_date,
    end_date: pass.end_date,
    amount_cents: pass.amount_cents,
    is_guest: pass.is_guest,
    purchased_by: pass.purchased_by,
    assigned_desk_id: pass.assigned_desk_id,
    created_at: pass.created_at,
    user: profileMap.get(pass.user_id) ?? null,
    desk: pass.desk as unknown as { name: string } | null,
    purchaser: pass.purchased_by
      ? profileMap.get(pass.purchased_by) ?? null
      : null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Passes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View and manage day and week passes.
        </p>
      </div>

      <PassesTable passes={passesWithProfiles} spaceUsers={spaceUsersResult} />
    </div>
  );
}
