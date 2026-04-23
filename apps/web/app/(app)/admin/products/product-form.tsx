"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { productSchema, purchaseFlowForCategory, type ProductFormValues } from "./schemas";
import { createProduct, updateProduct } from "./actions";

const CATEGORIES = [
  { value: "pass", label: "Pass", hint: "Day or week passes" },
  { value: "hour_bundle", label: "Hour Bundle", hint: "Bulk hours for credit" },
  { value: "addon", label: "Add-on", hint: "Subscription add-on" },
  { value: "deposit", label: "Deposit", hint: "Prepaid credit" },
  { value: "event", label: "Event", hint: "Event tickets" },
] as const;

const CURRENCIES = ["eur", "gbp", "usd", "chf"] as const;

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
  pass_type: "day" | "week" | null;
  duration_days: number | null;
  consecutive_days: boolean;
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

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product;
  resourceTypes: ResourceType[];
  plans: Plan[];
  defaultCurrency: string;
  nextSortOrder: number;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      {children}
    </div>
  );
}

export function ProductForm({
  open,
  onOpenChange,
  product,
  resourceTypes,
  plans,
  defaultCurrency,
  nextSortOrder,
}: ProductFormProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!product;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? "",
      slug: product?.slug ?? "",
      description: product?.description ?? "",
      category: (product?.category as ProductFormValues["category"]) ?? "pass",
      priceCents: product?.price_cents ?? 0,
      currency: product?.currency ?? defaultCurrency,
      ivaRate: product?.iva_rate ?? 21,
      passType: (product?.pass_type as "day" | "week" | undefined) ?? undefined,
      durationDays: product?.duration_days ?? undefined,
      consecutiveDays: product?.consecutive_days ?? true,
      planId: product?.plan_id ?? "",
      creditGrantConfig: product?.credit_grant_config
        ? {
            resourceTypeId: product.credit_grant_config.resource_type_id,
            minutes: product.credit_grant_config.minutes,
          }
        : undefined,
      visibilityRules: {
        requireMembership: product?.visibility_rules?.require_membership ?? false,
        requireNoMembership: product?.visibility_rules?.require_no_membership ?? false,
        requirePlanIds: product?.visibility_rules?.require_plan_ids ?? [],
        excludeUnlimited: product?.visibility_rules?.exclude_unlimited ?? false,
      },
      sortOrder: product?.sort_order ?? nextSortOrder,
      active: product?.active !== false,
    },
  });

  const watchCategory = watch("category");
  const watchCurrency = watch("currency");
  const watchActive = watch("active");
  const watchVisibility = watch("visibilityRules");
  const watchCreditConfig = watch("creditGrantConfig");

  function onSubmit(data: ProductFormValues) {
    setServerError(null);
    startTransition(async () => {
      const result = isEdit
        ? await updateProduct(product.id, data)
        : await createProduct(data);
      if (!result.success) {
        setServerError(result.error);
      } else {
        onOpenChange(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto sm:max-w-xl"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Product" : "Create Product"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update product details, pricing, and visibility."
              : "Add a new product to your store."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {serverError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {serverError}
            </p>
          )}

          {/* ── Basics ── */}
          <FormSection title="Basics">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  {...register("name", {
                    onChange: (e) => {
                      if (!isEdit) {
                        setValue("slug", slugify(e.target.value));
                      }
                    },
                  })}
                  placeholder="Day Pass"
                />
                {errors.name && (
                  <p className="text-xs text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  {...register("slug")}
                  placeholder="day-pass"
                />
                {errors.slug && (
                  <p className="text-xs text-destructive">
                    {errors.slug.message}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">
                Description{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="description"
                {...register("description")}
                placeholder="A full day of workspace access..."
                rows={2}
              />
            </div>
          </FormSection>

          <Separator />

          {/* ── Category ── */}
          <FormSection title="Category">
            <div className="space-y-1.5">
              <Label htmlFor="category">Product type</Label>
              <Select
                value={watchCategory}
                onValueChange={(v) => {
                  if (v) setValue("category", v as ProductFormValues["category"]);
                }}
                items={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <div className="flex flex-col">
                        <span>{c.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {c.hint}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Purchase flow: <span className="font-medium">{purchaseFlowForCategory(watchCategory)}</span>
              </p>
            </div>
          </FormSection>

          {/* ── Pass Configuration ── */}
          {watchCategory === "pass" && (
            <>
              <Separator />
              <FormSection title="Pass Configuration">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="passType">Pass type</Label>
                    <Select
                      value={watch("passType") ?? ""}
                      onValueChange={(v) => {
                        if (v === "day" || v === "week") {
                          setValue("passType", v);
                          if (v === "day") setValue("durationDays", 1);
                          if (v === "week") setValue("durationDays", 5);
                        }
                      }}
                      items={[
                        { value: "day", label: "Day Pass" },
                        { value: "week", label: "Week Pass" },
                      ]}
                    >
                      <SelectTrigger id="passType">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Day Pass</SelectItem>
                        <SelectItem value="week">Week Pass</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.passType && (
                      <p className="text-xs text-destructive">
                        {errors.passType.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="durationDays">Duration (days)</Label>
                    <Input
                      id="durationDays"
                      type="number"
                      min={1}
                      max={30}
                      {...register("durationDays", { valueAsNumber: true })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Business days (weekends skipped)
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <Switch
                      checked={watch("consecutiveDays") ?? true}
                      onCheckedChange={(checked) =>
                        setValue("consecutiveDays", checked)
                      }
                      size="sm"
                    />
                    <Label className="text-sm">Consecutive days</Label>
                  </div>
                </div>
              </FormSection>
            </>
          )}

          <Separator />

          {/* ── Pricing ── */}
          <FormSection title="Pricing">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="price">Price</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                    {watchCurrency.toUpperCase()}
                  </span>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    step={0.01}
                    defaultValue={
                      product ? (product.price_cents / 100).toFixed(2) : ""
                    }
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setValue(
                        "priceCents",
                        isNaN(val) ? 0 : Math.round(val * 100)
                      );
                    }}
                    placeholder="35.00"
                    className="pl-11"
                  />
                </div>
                {errors.priceCents && (
                  <p className="text-xs text-destructive">
                    {errors.priceCents.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={watchCurrency}
                  onValueChange={(v) => {
                    if (v) setValue("currency", v);
                  }}
                  items={CURRENCIES.map((c) => ({ value: c, label: c.toUpperCase() }))}
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ivaRate">Tax rate (%)</Label>
                <Input
                  id="ivaRate"
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  {...register("ivaRate", { valueAsNumber: true })}
                />
              </div>
            </div>
          </FormSection>

          {/* ── Hour Bundle Config ── */}
          {watchCategory === "hour_bundle" && (
            <>
              <Separator />
              <FormSection title="Credit Grant">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="resourceType">Resource type</Label>
                    <Select
                      value={watchCreditConfig?.resourceTypeId ?? ""}
                      onValueChange={(v) => {
                        if (v) {
                          setValue("creditGrantConfig", {
                            resourceTypeId: v,
                            minutes: watchCreditConfig?.minutes ?? 600,
                          });
                        }
                      }}
                      items={resourceTypes.map((rt) => ({ value: rt.id, label: rt.name }))}
                    >
                      <SelectTrigger id="resourceType">
                        <SelectValue placeholder="Select resource type" />
                      </SelectTrigger>
                      <SelectContent>
                        {resourceTypes.map((rt) => (
                          <SelectItem key={rt.id} value={rt.id}>
                            {rt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="hours">Hours</Label>
                    <Input
                      id="hours"
                      type="number"
                      min={1}
                      step={1}
                      defaultValue={
                        watchCreditConfig
                          ? Math.round(watchCreditConfig.minutes / 60)
                          : ""
                      }
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val > 0) {
                          setValue("creditGrantConfig", {
                            resourceTypeId: watchCreditConfig?.resourceTypeId ?? "",
                            minutes: val * 60,
                          });
                        }
                      }}
                      placeholder="10"
                    />
                    <p className="text-xs text-muted-foreground">
                      {watchCreditConfig?.minutes
                        ? `${watchCreditConfig.minutes} minutes`
                        : "Enter number of hours"}
                    </p>
                  </div>
                </div>
              </FormSection>
            </>
          )}

          {/* ── Add-on Plan Link ── */}
          {watchCategory === "addon" && plans.length > 0 && (
            <>
              <Separator />
              <FormSection title="Linked Plan">
                <div className="space-y-1.5">
                  <Label htmlFor="planId">
                    Plan{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <Select
                    value={watch("planId") ?? ""}
                    onValueChange={(v) => setValue("planId", v === "none" ? "" : (v ?? ""))}
                    items={[{ value: "none", label: "No plan linked" }, ...plans.map((p) => ({ value: p.id, label: p.name }))]}
                  >
                    <SelectTrigger id="planId">
                      <SelectValue placeholder="No plan linked" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No plan linked</SelectItem>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </FormSection>
            </>
          )}

          <Separator />

          {/* ── Visibility Rules ── */}
          <FormSection title="Visibility Rules">
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50">
                <Checkbox
                  checked={watchVisibility.requireMembership ?? false}
                  onCheckedChange={(checked) =>
                    setValue("visibilityRules", {
                      ...watchVisibility,
                      requireMembership: checked === true,
                      requireNoMembership: checked === true ? false : watchVisibility.requireNoMembership,
                    })
                  }
                />
                <div>
                  <span className="text-sm font-medium">Members only</span>
                  <p className="text-xs text-muted-foreground">
                    Only visible to active members.
                  </p>
                </div>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50">
                <Checkbox
                  checked={watchVisibility.requireNoMembership ?? false}
                  onCheckedChange={(checked) =>
                    setValue("visibilityRules", {
                      ...watchVisibility,
                      requireNoMembership: checked === true,
                      requireMembership: checked === true ? false : watchVisibility.requireMembership,
                    })
                  }
                />
                <div>
                  <span className="text-sm font-medium">Non-members only</span>
                  <p className="text-xs text-muted-foreground">
                    Only visible to users without an active plan.
                  </p>
                </div>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50">
                <Checkbox
                  checked={watchVisibility.excludeUnlimited ?? false}
                  onCheckedChange={(checked) =>
                    setValue("visibilityRules", {
                      ...watchVisibility,
                      excludeUnlimited: checked === true,
                    })
                  }
                />
                <div>
                  <span className="text-sm font-medium">Hide from unlimited members</span>
                  <p className="text-xs text-muted-foreground">
                    For hour bundles, hides from members with unlimited credits
                    for the bundle&apos;s resource type. Other products hide from
                    members with any unlimited credits.
                  </p>
                </div>
              </label>
            </div>

            {plans.length > 0 && (
              <div className="space-y-1.5">
                <Label>Restrict to specific plans</Label>
                <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                  {plans.map((p) => {
                    const selected = watchVisibility.requirePlanIds ?? [];
                    const isChecked = selected.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            const next = checked
                              ? [...selected, p.id]
                              : selected.filter((id) => id !== p.id);
                            setValue("visibilityRules", {
                              ...watchVisibility,
                              requirePlanIds: next,
                            });
                          }}
                        />
                        <span className="text-sm">{p.name}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave empty to show to all plans.
                </p>
              </div>
            )}
          </FormSection>

          <Separator />

          {/* ── Footer ── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sortOrder">Sort order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  className="w-20"
                  {...register("sortOrder", { valueAsNumber: true })}
                />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch
                  checked={watchActive}
                  onCheckedChange={(checked) => setValue("active", checked)}
                  size="sm"
                />
                <Label className="text-sm">Active</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Saving..."
                : isEdit
                  ? "Save Changes"
                  : "Create Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
