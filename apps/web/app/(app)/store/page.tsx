import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isProductVisible } from "@/lib/products/visibility";
import { ProductGrid } from "./product-grid";

export default async function StorePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const spaceId = user.app_metadata?.space_id as string | undefined;
  if (!spaceId) redirect("/login");

  // Fetch active products, member context, and space config in parallel
  let productsResult, memberResult, spaceResult;
  try {
    [productsResult, memberResult, spaceResult] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, slug, description, price_cents, currency, category, purchase_flow, sort_order, visibility_rules, credit_grant_config")
        .eq("active", true)
        .neq("category", "subscription")
        .order("sort_order", { ascending: true }),
      supabase
        .from("members")
        .select("id, plan_id, status, plan:plans(id, plan_credit_config(resource_type_id, is_unlimited))")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("spaces")
        .select("features")
        .eq("id", spaceId)
        .single(),
    ]);
  } catch {
    productsResult = { data: null };
    memberResult = { data: null };
    spaceResult = { data: null };
  }

  const products = productsResult.data ?? [];
  const member = memberResult.data;
  const features = (spaceResult.data?.features ?? {}) as Record<string, boolean>;

  // Build member context for visibility filtering
  const planCreditConfigs = (
    member?.plan as unknown as {
      id: string;
      plan_credit_config: Array<{ resource_type_id: string; is_unlimited: boolean }>;
    } | null
  )?.plan_credit_config;

  const memberContext = {
    isMember: member?.status === "active",
    planId: member?.plan_id ?? null,
    unlimitedResourceTypeIds:
      planCreditConfigs
        ?.filter((c) => c.is_unlimited)
        .map((c) => c.resource_type_id) ?? [],
  };

  // Filter products by visibility and enabled features
  const visibleProducts = products.filter((p) => {
    const productResourceTypeId = (
      p.credit_grant_config as { resource_type_id?: string } | null
    )?.resource_type_id;
    if (!isProductVisible(p.visibility_rules, memberContext, productResourceTypeId))
      return false;
    if (p.category === "pass" && features.passes === false) return false;
    if (p.category === "hour_bundle" && features.credits === false) return false;
    return true;
  });

  const hasActiveMembership =
    member?.status === "active" ||
    member?.status === "cancelling" ||
    member?.status === "past_due" ||
    member?.status === "paused";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Store</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Purchase passes, hour bundles, and add-ons.
        </p>
      </div>

      <ProductGrid
        products={visibleProducts.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price_cents: p.price_cents,
          currency: p.currency,
          category: p.category,
          purchase_flow: p.purchase_flow,
          slug: p.slug,
          sort_order: p.sort_order,
        }))}
        hasActiveMembership={hasActiveMembership ?? false}
        guestPassesEnabled={features.guest_passes !== false}
      />
    </div>
  );
}
