"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { purchaseProduct, purchaseAddon } from "./actions";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    description: string | null;
    price_cents: number;
    currency: string;
    category: string;
    purchase_flow: string;
    slug: string;
  };
  hasActiveMembership: boolean;
  onError: (msg: string) => void;
  onPassPurchase: (productId: string) => void;
}

function formatPrice(cents: number, currency: string): string {
  const amount = cents / 100;
  const symbol =
    currency.toLowerCase() === "eur" ? "\u20AC" : currency.toUpperCase() + " ";
  return `${symbol}${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

export function ProductCard({
  product,
  hasActiveMembership,
  onError,
  onPassPurchase,
}: ProductCardProps) {
  const [isPending, startTransition] = useTransition();

  const isRecurring = product.purchase_flow === "subscription_addon";

  function handleAction() {
    if (product.purchase_flow === "date_picker") {
      onPassPurchase(product.id);
      return;
    }

    startTransition(async () => {
      if (product.purchase_flow === "subscription_addon") {
        const result = await purchaseAddon(product.id);
        if (!result.success) {
          onError(result.error);
        }
      } else {
        const result = await purchaseProduct(product.id);
        if (!result.success) {
          onError(result.error);
          return;
        }
        window.location.href = result.url;
      }
    });
  }

  const addonDisabled =
    product.purchase_flow === "subscription_addon" && !hasActiveMembership;

  return (
    <div className="flex flex-col rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">{product.name}</h3>
          {product.category === "addon" && (
            <Badge variant="outline" className="text-xs">
              Add-on
            </Badge>
          )}
        </div>
        {product.description && (
          <p className="mt-1 text-sm text-zinc-500">{product.description}</p>
        )}
      </div>

      <div className="mb-6 flex-1">
        <span className="text-3xl font-bold">
          {formatPrice(product.price_cents, product.currency)}
        </span>
        {isRecurring && <span className="text-sm text-zinc-500">/mo</span>}
      </div>

      <Button
        onClick={handleAction}
        disabled={isPending || addonDisabled}
        variant="default"
        size="lg"
        className="w-full"
      >
        {isPending
          ? "Processing..."
          : addonDisabled
            ? "Requires Active Subscription"
            : product.purchase_flow === "subscription_addon"
              ? "Add to Subscription"
              : "Buy"}
      </Button>
    </div>
  );
}
