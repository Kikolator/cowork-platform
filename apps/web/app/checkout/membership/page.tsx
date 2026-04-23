import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { AvailabilityGate } from "../_components/availability-gate";
import { CheckoutForm } from "../_components/checkout-form";

interface MembershipCheckoutPageProps {
  searchParams: Promise<{ plan?: string }>;
}

export default async function MembershipCheckoutPage({
  searchParams,
}: MembershipCheckoutPageProps) {
  const { plan: planSlug } = await searchParams;
  const headersList = await headers();
  const spaceId = headersList.get("x-space-id");

  if (!spaceId) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Space not found.
      </p>
    );
  }

  if (!planSlug) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        No plan specified. Please select a plan from the website.
      </p>
    );
  }

  const admin = createAdminClient();

  // Fetch community rules
  const { data: space } = await admin
    .from("spaces")
    .select("community_rules_text")
    .eq("id", spaceId)
    .single();
  const communityRulesText = (space as Record<string, unknown> | null)
    ?.community_rules_text as string | null ?? null;

  const { data: plan } = await admin
    .from("plans")
    .select("id, name, description, price_cents, currency, capacity")
    .eq("space_id", spaceId)
    .eq("slug", planSlug)
    .eq("active", true)
    .single();

  if (!plan) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Plan not found. It may no longer be available.
      </p>
    );
  }

  let available = true;
  let spotsLeft: number | undefined;

  if (plan.capacity !== null) {
    const { count } = await admin
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("space_id", spaceId)
      .eq("plan_id", plan.id)
      .in("status", ["active", "paused"]);

    const activeMembers = count ?? 0;
    spotsLeft = Math.max(plan.capacity - activeMembers, 0);
    available = spotsLeft > 0;
  }

  const priceFormatted = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: plan.currency,
  }).format(plan.price_cents / 100);

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-semibold text-foreground">{plan.name}</h2>
        <p className="text-2xl font-bold text-foreground">
          {priceFormatted}
          <span className="text-sm font-normal text-muted-foreground">
            /month
          </span>
        </p>
        {plan.description && (
          <p className="text-sm text-muted-foreground">{plan.description}</p>
        )}
      </div>

      <AvailabilityGate
        available={available}
        spotsLeft={spotsLeft}
        unavailableMessage="This plan is currently full."
      >
        <CheckoutForm
          type="membership"
          planSlug={planSlug}
          communityRulesText={communityRulesText}
        />
      </AvailabilityGate>
    </div>
  );
}
