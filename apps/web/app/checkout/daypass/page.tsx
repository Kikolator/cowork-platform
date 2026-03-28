import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { AvailabilityGate } from "../_components/availability-gate";
import { CheckoutForm } from "../_components/checkout-form";

export default async function DaypassCheckoutPage() {
  const headersList = await headers();
  const spaceId = headersList.get("x-space-id");

  if (!spaceId) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Space not found.
      </p>
    );
  }

  const admin = createAdminClient();
  const { data: space } = await admin
    .from("spaces")
    .select("daypass_enabled, daypass_daily_limit, daypass_price_cents, daypass_currency")
    .eq("id", spaceId)
    .single();

  if (!space || !space.daypass_enabled || !space.daypass_price_cents) {
    return (
      <AvailabilityGate available={false} unavailableMessage="Day passes are not available for this space.">
        <div />
      </AvailabilityGate>
    );
  }

  let available = true;
  let spotsLeft: number | undefined;

  if (space.daypass_daily_limit !== null) {
    const today = new Date().toISOString().split("T")[0];
    const { count } = await admin
      .from("passes")
      .select("id", { count: "exact", head: true })
      .eq("space_id", spaceId)
      .eq("start_date", today!)
      .in("status", ["active", "used"]);

    const sold = count ?? 0;
    spotsLeft = Math.max(space.daypass_daily_limit - sold, 0);
    available = spotsLeft > 0;
  }

  const priceFormatted = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: space.daypass_currency,
  }).format(space.daypass_price_cents / 100);

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-semibold text-foreground">Day Pass</h2>
        <p className="text-2xl font-bold text-foreground">{priceFormatted}</p>
        <p className="text-sm text-muted-foreground">
          Full day access to the workspace
        </p>
      </div>

      <AvailabilityGate
        available={available}
        spotsLeft={spotsLeft}
        unavailableMessage="No day passes available today."
      >
        <CheckoutForm type="daypass" />
      </AvailabilityGate>
    </div>
  );
}
