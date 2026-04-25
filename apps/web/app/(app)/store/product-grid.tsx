"use client";

import { useState } from "react";
import { ProductCard } from "./product-card";
import { PassPurchaseDialog } from "./pass-purchase-dialog";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  category: string;
  purchase_flow: string;
  slug: string;
  sort_order: number | null;
}

interface ProductGridProps {
  products: Product[];
  hasActiveMembership: boolean;
  guestPassesEnabled: boolean;
  communityRulesText: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  pass: "Passes",
  hour_bundle: "Hour Bundles",
  addon: "Add-ons",
  deposit: "Deposits",
  event: "Events",
};

const CATEGORY_ORDER = ["pass", "hour_bundle", "addon", "deposit", "event"];

export function ProductGrid({
  products,
  hasActiveMembership,
  guestPassesEnabled,
  communityRulesText,
}: ProductGridProps) {
  const [error, setError] = useState<string | null>(null);
  const [passProductId, setPassProductId] = useState<string | null>(null);

  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
        <p className="text-sm text-zinc-500">No products available.</p>
      </div>
    );
  }

  // Group products by category
  const grouped = new Map<string, Product[]>();
  for (const product of products) {
    const list = grouped.get(product.category) ?? [];
    list.push(product);
    grouped.set(product.category, list);
  }

  const passProduct = passProductId
    ? products.find((p) => p.id === passProductId) ?? null
    : null;

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {CATEGORY_ORDER.filter((cat) => grouped.has(cat)).map((category) => (
        <div key={category} className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">
            {CATEGORY_LABELS[category] ?? category}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {grouped.get(category)!.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                hasActiveMembership={hasActiveMembership}
                onError={setError}
                onPassPurchase={(id) => setPassProductId(id)}
              />
            ))}
          </div>
        </div>
      ))}

      <PassPurchaseDialog
        open={passProductId !== null}
        onOpenChange={(open) => {
          if (!open) setPassProductId(null);
        }}
        product={passProduct}
        guestPassesEnabled={guestPassesEnabled}
        communityRulesText={communityRulesText}
        onError={setError}
      />
    </div>
  );
}
