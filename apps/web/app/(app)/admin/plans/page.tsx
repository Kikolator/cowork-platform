import { createClient } from "@/lib/supabase/server";
import { PlansTable } from "./plans-table";

export default async function PlansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const spaceId = user?.app_metadata?.space_id as string | undefined;

  const [{ data: plans }, { data: resourceTypes }, { data: space }] = await Promise.all([
    supabase
      .from("plans")
      .select("*, plan_credit_config(*, resource_types(id, name))")
      .order("sort_order", { ascending: true }),
    supabase
      .from("resource_types")
      .select("id, name")
      .order("sort_order", { ascending: true }),
    spaceId
      ? supabase.from("spaces").select("currency").eq("id", spaceId).single()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <PlansTable
      plans={(plans ?? []).map((p) => ({
        ...p,
        plan_credit_config: (p.plan_credit_config ?? []).map((cc: Record<string, unknown>) => ({
          resource_type_id: cc.resource_type_id as string,
          monthly_minutes: cc.monthly_minutes as number,
          is_unlimited: cc.is_unlimited as boolean,
          resource_types: cc.resource_types as { id: string; name: string } | null,
        })),
      }))}
      resourceTypes={resourceTypes ?? []}
      defaultCurrency={space?.currency ?? "eur"}
    />
  );
}
