"use client";

import { useState, useTransition } from "react";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Plus,
  Package,
  Clock,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toggleProductActive, deleteProduct } from "./actions";
import { ProductForm } from "./product-form";

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  price_cents: number;
  currency: string;
  iva_rate: number;
  plan_id: string | null;
  credit_grant_config: { resource_type_id: string; minutes: number } | null;
  visibility_rules: {
    require_membership?: boolean;
    require_no_membership?: boolean;
    require_plan_ids?: string[];
    exclude_unlimited?: boolean;
  };
  active: boolean | null;
  sort_order: number | null;
}

interface ResourceType {
  id: string;
  name: string;
}

interface Plan {
  id: string;
  name: string;
}

interface ProductsTableProps {
  products: Product[];
  resourceTypes: ResourceType[];
  plans: Plan[];
  defaultCurrency: string;
}

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

const CATEGORY_CONFIG: Record<string, { label: string; className: string }> = {
  pass: {
    label: "Pass",
    className: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  hour_bundle: {
    label: "Hour Bundle",
    className: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  addon: {
    label: "Add-on",
    className: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  },
  deposit: {
    label: "Deposit",
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  event: {
    label: "Event",
    className: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  },
};

function ProductDetails({
  product,
  resourceTypes,
  plans,
}: {
  product: Product;
  resourceTypes: ResourceType[];
  plans: Plan[];
}) {
  if (product.category === "hour_bundle" && product.credit_grant_config) {
    const rt = resourceTypes.find(
      (r) => r.id === product.credit_grant_config!.resource_type_id
    );
    const hours = Math.round(product.credit_grant_config.minutes / 60);
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        {hours}h {rt?.name ?? "Unknown"}
      </span>
    );
  }

  if (product.category === "addon" && product.plan_id) {
    const plan = plans.find((p) => p.id === product.plan_id);
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Link2 className="h-3 w-3" />
        {plan?.name ?? "Unknown plan"}
      </span>
    );
  }

  return <span className="text-xs text-muted-foreground">—</span>;
}

export function ProductsTable({
  products,
  resourceTypes,
  plans,
  defaultCurrency,
}: ProductsTableProps) {
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const nextSortOrder =
    products.length > 0
      ? Math.max(...products.map((p) => p.sort_order ?? 0)) + 10
      : 10;

  function handleToggleActive(productId: string, active: boolean) {
    startTransition(async () => {
      await toggleProductActive(productId, active);
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteProduct(deleteTarget.id);
      if (!result.success) {
        setDeleteError(result.error);
      } else {
        setDeleteTarget(null);
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage passes, hour bundles, add-ons, and other store products.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="default">
          <Plus className="mr-1.5 h-4 w-4" />
          Create Product
        </Button>
      </div>

      {products.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <Package className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-base font-medium">No products yet</h3>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            Products are what your members can purchase in the store — passes,
            hour bundles, add-ons, and more. Create your first product to get
            started.
          </p>
          <Button onClick={() => setCreateOpen(true)} className="mt-5">
            <Plus className="mr-1.5 h-4 w-4" />
            Create your first product
          </Button>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[220px]">Product</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="w-20 text-center">Active</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const isActive = product.active !== false;
                const catCfg =
                  CATEGORY_CONFIG[product.category] ?? CATEGORY_CONFIG.pass!;

                return (
                  <TableRow
                    key={product.id}
                    className={!isActive ? "bg-muted/30" : ""}
                  >
                    <TableCell>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{product.name}</span>
                          <span
                            className={`inline-flex items-center rounded-md border border-transparent px-1.5 py-0.5 text-[10px] font-medium leading-none ${catCfg.className}`}
                          >
                            {catCfg.label}
                          </span>
                          {!isActive && (
                            <Badge
                              variant="outline"
                              className="text-[10px] leading-none px-1.5 py-0.5"
                            >
                              Paused
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="text-base font-semibold tabular-nums">
                          {formatPrice(product.price_cents, product.currency)}
                        </span>
                      </div>
                      {product.iva_rate > 0 && (
                        <span className="text-[11px] text-muted-foreground">
                          +{product.iva_rate}% tax
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ProductDetails
                        product={product}
                        resourceTypes={resourceTypes}
                        plans={plans}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={isActive}
                        onCheckedChange={(checked) =>
                          handleToggleActive(product.id, checked)
                        }
                        disabled={isPending}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon-xs" />
                          }
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setEditProduct(product)}
                          >
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Edit product
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(product)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Delete product
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create dialog */}
      <ProductForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        resourceTypes={resourceTypes}
        plans={plans}
        defaultCurrency={defaultCurrency}
        nextSortOrder={nextSortOrder}
      />

      {/* Edit dialog */}
      {editProduct && (
        <ProductForm
          open={true}
          onOpenChange={(open) => {
            if (!open) setEditProduct(null);
          }}
          product={editProduct}
          resourceTypes={resourceTypes}
          plans={plans}
          defaultCurrency={defaultCurrency}
          nextSortOrder={nextSortOrder}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &ldquo;{deleteTarget?.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this product from your store. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              onClick={handleDelete}
              disabled={isPending}
              variant="destructive"
            >
              {isPending ? "Deleting..." : "Delete product"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
