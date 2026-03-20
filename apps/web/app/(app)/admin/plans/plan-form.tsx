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
import { planSchema, type PlanFormValues } from "./schemas";
import { createPlan, updatePlan } from "./actions";
import { PlanCreditConfig } from "./plan-credit-config";

const ACCESS_TYPES = [
  { value: "none", label: "None", hint: "No physical access" },
  {
    value: "business_hours",
    label: "Business Hours",
    hint: "Access during opening hours",
  },
  {
    value: "extended",
    label: "Extended",
    hint: "Early morning to late evening",
  },
  {
    value: "twenty_four_seven",
    label: "24/7",
    hint: "Around-the-clock access",
  },
] as const;

const CURRENCIES = ["eur", "gbp", "usd", "chf"] as const;

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  currency: string;
  iva_rate: number;
  access_type: string;
  has_fixed_desk: boolean | null;
  sort_order: number | null;
  plan_credit_config: Array<{
    resource_type_id: string;
    monthly_minutes: number;
    is_unlimited: boolean;
  }>;
}

interface ResourceType {
  id: string;
  name: string;
}

interface PlanFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: Plan;
  resourceTypes: ResourceType[];
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

export function PlanForm({
  open,
  onOpenChange,
  plan,
  resourceTypes,
  defaultCurrency,
  nextSortOrder,
}: PlanFormProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!plan;

  const defaultCreditConfig =
    plan?.plan_credit_config.map((cc) => ({
      resourceTypeId: cc.resource_type_id,
      monthlyMinutes: cc.monthly_minutes,
      isUnlimited: cc.is_unlimited,
    })) ?? [];

  const [creditConfig, setCreditConfig] = useState(defaultCreditConfig);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: plan?.name ?? "",
      slug: plan?.slug ?? "",
      description: plan?.description ?? "",
      priceCents: plan?.price_cents ?? 0,
      currency: plan?.currency ?? defaultCurrency,
      ivaRate: plan?.iva_rate ?? 21,
      accessType:
        (plan?.access_type as PlanFormValues["accessType"]) ?? "business_hours",
      hasFixedDesk: plan?.has_fixed_desk ?? false,
      sortOrder: plan?.sort_order ?? nextSortOrder,
      creditConfig: defaultCreditConfig,
    },
  });

  const watchCurrency = watch("currency");
  const watchHasFixedDesk = watch("hasFixedDesk");
  const watchAccessType = watch("accessType");

  function onSubmit(data: PlanFormValues) {
    setServerError(null);
    const payload = { ...data, creditConfig };
    startTransition(async () => {
      const result = isEdit
        ? await updatePlan(plan.id, payload)
        : await createPlan(payload);
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
            {isEdit ? "Edit Plan" : "Create Plan"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update pricing, access rules, and credit allowances."
              : "Set up a new membership tier for your space."}
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
                  placeholder="Pro Membership"
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
                  placeholder="pro-membership"
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
                placeholder="Ideal for freelancers who need a flexible workspace..."
                rows={2}
              />
            </div>
          </FormSection>

          <Separator />

          {/* ── Pricing ── */}
          <FormSection title="Pricing">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="price">
                  Monthly price
                </Label>
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
                      plan ? (plan.price_cents / 100).toFixed(2) : ""
                    }
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setValue(
                        "priceCents",
                        isNaN(val) ? 0 : Math.round(val * 100)
                      );
                    }}
                    placeholder="49.00"
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

          <Separator />

          {/* ── Access & Perks ── */}
          <FormSection title="Access & Perks">
            <div className="space-y-1.5">
              <Label htmlFor="accessType">Access level</Label>
              <Select
                value={watchAccessType}
                onValueChange={(v) => {
                  if (v)
                    setValue(
                      "accessType",
                      v as PlanFormValues["accessType"]
                    );
                }}
                items={ACCESS_TYPES.map((at) => ({ value: at.value, label: at.label }))}
              >
                <SelectTrigger id="accessType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCESS_TYPES.map((at) => (
                    <SelectItem key={at.value} value={at.value}>
                      <div className="flex flex-col">
                        <span>{at.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {at.hint}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50">
              <Checkbox
                id="hasFixedDesk"
                checked={watchHasFixedDesk}
                onCheckedChange={(checked) =>
                  setValue("hasFixedDesk", checked === true)
                }
              />
              <div>
                <span className="text-sm font-medium">
                  Fixed desk included
                </span>
                <p className="text-xs text-muted-foreground">
                  Members on this plan are assigned a dedicated desk.
                </p>
              </div>
            </label>
          </FormSection>

          <Separator />

          {/* ── Credits ── */}
          <FormSection title="Monthly Credits">
            <PlanCreditConfig
              resourceTypes={resourceTypes}
              value={creditConfig}
              onChange={setCreditConfig}
            />
          </FormSection>

          {/* Hidden sort order */}
          <input type="hidden" {...register("sortOrder", { valueAsNumber: true })} />

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
                  : "Create Plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
