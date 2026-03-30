import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgramForm } from "./program-form";
import { ReferralsTable } from "./referrals-table";

export default async function AdminReferralsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const spaceId = user.app_metadata?.space_id as string | undefined;
  if (!spaceId) return null;

  // Check feature flag
  const { data: space } = await supabase
    .from("spaces")
    .select("features")
    .eq("id", spaceId)
    .single();

  const featureFlags = (space?.features ?? {}) as Record<string, boolean>;

  if (!featureFlags.referrals) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Referrals</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Enable the Referrals feature flag in Settings to get started.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [
    { data: program },
    { data: resourceTypes },
    { data: referrals },
    { count: completedCount },
    { count: pendingCount },
  ] = await Promise.all([
    supabase
      .from("referral_programs")
      .select("*")
      .eq("space_id", spaceId)
      .maybeSingle(),
    supabase
      .from("resource_types")
      .select("id, name")
      .eq("space_id", spaceId)
      .order("name"),
    supabase
      .from("referrals")
      .select("id, referred_email, status, referrer_rewarded, referrer_reward_type, completed_at, created_at, referrer_user_id, referred_user_id")
      .eq("space_id", spaceId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("space_id", spaceId)
      .eq("status", "completed"),
    supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("space_id", spaceId)
      .eq("status", "pending"),
  ]);

  // Resolve user names for referrals
  const userIds = new Set<string>();
  for (const r of referrals ?? []) {
    if (r.referrer_user_id) userIds.add(r.referrer_user_id);
    if (r.referred_user_id) userIds.add(r.referred_user_id);
  }

  const { data: profiles } = userIds.size > 0
    ? await supabase
        .from("shared_profiles")
        .select("id, full_name")
        .in("id", [...userIds])
    : { data: [] };

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name]),
  );

  const enrichedReferrals = (referrals ?? []).map((r) => ({
    id: r.id,
    referred_email: r.referred_email,
    status: r.status,
    referrer_rewarded: r.referrer_rewarded,
    referrer_reward_type: r.referrer_reward_type,
    completed_at: r.completed_at,
    created_at: r.created_at,
    referrer_name: r.referrer_user_id ? profileMap.get(r.referrer_user_id) ?? null : null,
    referred_name: r.referred_user_id ? profileMap.get(r.referred_user_id) ?? null : null,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Referrals</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{completedCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{pendingCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {program?.active ? "Active" : "Inactive"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Program Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgramForm
            program={program}
            resourceTypes={resourceTypes ?? []}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Referrals</CardTitle>
        </CardHeader>
        <CardContent>
          <ReferralsTable referrals={enrichedReferrals} />
        </CardContent>
      </Card>
    </div>
  );
}
