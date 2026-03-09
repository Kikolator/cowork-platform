import { createClient } from "@/lib/supabase/server";
import { ProductsTable } from "./products-table";

export default async function ProductsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const spaceId = user?.app_metadata?.space_id as string | undefined;

  const [{ data: products }, { data: resourceTypes }, { data: plans }, { data: space }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, name, slug, description, category, price_cents, currency, iva_rate, plan_id, credit_grant_config, visibility_rules, active, sort_order")
        .order("sort_order", { ascending: true }),
      supabase
        .from("resource_types")
        .select("id, name")
        .order("sort_order", { ascending: true }),
      supabase
        .from("plans")
        .select("id, name")
        .order("sort_order", { ascending: true }),
      spaceId
        ? supabase.from("spaces").select("currency").eq("id", spaceId).single()
        : Promise.resolve({ data: null }),
    ]);

  return (
    <ProductsTable
      products={(products ?? []).map((p) => ({
        ...p,
        credit_grant_config: p.credit_grant_config as { resource_type_id: string; minutes: number } | null,
        visibility_rules: (p.visibility_rules ?? {}) as {
          require_membership?: boolean;
          require_no_membership?: boolean;
          require_plan_ids?: string[];
          exclude_unlimited?: boolean;
        },
      }))}
      resourceTypes={resourceTypes ?? []}
      plans={plans ?? []}
      defaultCurrency={space?.currency ?? "eur"}
    />
  );
}
