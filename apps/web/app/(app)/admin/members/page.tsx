import { createClient } from "@/lib/supabase/server";
import { MembersTable } from "./members-table";

export default async function MembersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const spaceId = user?.app_metadata?.space_id as string | undefined;

  let members, plans, desks, notes;
  try {
    [{ data: members }, { data: plans }, { data: desks }, { data: notes }] =
      await Promise.all([
        supabase
          .from("members")
          .select("*, plans(id, name)")
          .order("joined_at", { ascending: false }),
        supabase
          .from("plans")
          .select("id, name, price_cents, currency")
          .order("sort_order", { ascending: true }),
        supabase
          .from("resources")
          .select("id, name, resource_types!inner(slug)")
          .eq("resource_types.slug", "desk")
          .order("name", { ascending: true }),
        supabase
          .from("member_notes")
          .select("id, member_id, author_id, content, category, created_at")
          .order("created_at", { ascending: false }),
      ]);
  } catch {
    members = null;
    plans = null;
    desks = null;
    notes = null;
  }

  // Collect all user IDs (members + note authors) for profile lookup
  const memberUserIds = (members ?? []).map((m) => m.user_id);
  const noteAuthorIds = (notes ?? []).map((n) => n.author_id);
  const allUserIds = [...new Set([...memberUserIds, ...noteAuthorIds])];

  const { data: profiles } =
    allUserIds.length > 0
      ? await supabase
          .from("shared_profiles")
          .select("id, full_name, email, phone, avatar_url, last_login_at")
          .in("id", allUserIds)
      : { data: [] };

  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p]),
  );

  return (
    <MembersTable
      // TODO: remove casts after running `supabase gen types` with the billing_mode migration
      members={(members ?? []).map((m) => ({
        ...m,
        billing_mode: (m as Record<string, unknown>).billing_mode as string | null ?? null,
        custom_price_cents: (m as Record<string, unknown>).custom_price_cents as number | null ?? null,
        plan: m.plans as unknown as { id: string; name: string } | null,
      }))}
      plans={plans ?? []}
      desks={(desks ?? []).map((d) => ({ id: d.id, name: d.name }))}
      profileMap={profileMap}
      notes={(notes ?? []).map((n) => ({
        id: n.id,
        member_id: n.member_id,
        author_id: n.author_id,
        content: n.content,
        category: n.category as string,
        created_at: n.created_at ?? new Date().toISOString(),
      }))}
    />
  );
}
