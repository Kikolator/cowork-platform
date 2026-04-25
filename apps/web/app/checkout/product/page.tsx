import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { PassCheckoutForm } from "./_components/pass-checkout-form";

interface ProductCheckoutPageProps {
  searchParams: Promise<{ slug?: string }>;
}

export default async function ProductCheckoutPage({
  searchParams,
}: ProductCheckoutPageProps) {
  const { slug } = await searchParams;
  const headersList = await headers();
  const spaceId = headersList.get("x-space-id");

  if (!spaceId) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Space not found.
      </p>
    );
  }

  if (!slug) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        No product specified. Please use a valid checkout link.
      </p>
    );
  }

  const admin = createAdminClient();

  // Fetch the product by slug + space
  const { data: product } = await admin
    .from("products")
    .select("id, name, slug, description, price_cents, currency, category, active, pass_type, duration_days")
    .eq("space_id", spaceId)
    .eq("slug", slug)
    .eq("active", true)
    .single();

  if (!product) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Product not found. It may no longer be available.
      </p>
    );
  }

  if (product.category !== "pass") {
    return (
      <p className="text-center text-sm text-muted-foreground">
        This product cannot be purchased through this page.
      </p>
    );
  }

  // Read pass config via raw query since columns aren't in generated types yet
  const row = product as Record<string, unknown>;
  const passType = row.pass_type as string | null;
  const durationDays = row.duration_days as number | null;

  if (!passType || !durationDays) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        This pass is not configured correctly. Please contact the space.
      </p>
    );
  }

  // Fetch community rules
  const { data: space } = await admin
    .from("spaces")
    .select("community_rules_text")
    .eq("id", spaceId)
    .single();

  const communityRules = (space as Record<string, unknown> | null)
    ?.community_rules_text as string | null;

  const priceFormatted = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: product.currency,
  }).format(product.price_cents / 100);

  const passLabel = passType === "week" ? "Week Pass" : "Day Pass";
  const durationLabel =
    durationDays === 1
      ? "1 day"
      : `${durationDays} business days`;

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-semibold text-foreground">{product.name}</h2>
        <p className="text-2xl font-bold text-foreground">{priceFormatted}</p>
        <p className="text-sm text-muted-foreground">
          {passLabel} — {durationLabel}
        </p>
        {product.description && (
          <p className="text-sm text-muted-foreground">{product.description}</p>
        )}
      </div>

      <PassCheckoutForm
        productSlug={product.slug}
        durationDays={durationDays}
        communityRulesText={communityRules}
      />
    </div>
  );
}
