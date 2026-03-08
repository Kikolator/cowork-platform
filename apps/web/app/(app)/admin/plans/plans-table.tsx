"use client";

import { useState, useTransition } from "react";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Plus,
  CreditCard,
  Infinity,
  Clock,
  Armchair,
  Zap,
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
import { togglePlanActive, deletePlan } from "./actions";
import { PlanForm } from "./plan-form";

interface CreditConfig {
  resource_type_id: string;
  monthly_minutes: number;
  is_unlimited: boolean;
  resource_types: { id: string; name: string } | null;
}

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
  active: boolean | null;
  plan_credit_config: CreditConfig[];
}

interface ResourceType {
  id: string;
  name: string;
}

interface PlansTableProps {
  plans: Plan[];
  resourceTypes: ResourceType[];
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

const ACCESS_CONFIG: Record<string, { label: string; className: string }> = {
  none: {
    label: "No Access",
    className: "bg-muted text-muted-foreground",
  },
  business_hours: {
    label: "Business Hours",
    className: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  extended: {
    label: "Extended",
    className:
      "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  },
  twenty_four_seven: {
    label: "24/7",
    className:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
};

function CreditPills({ configs }: { configs: CreditConfig[] }) {
  const active = configs.filter((c) => c.is_unlimited || c.monthly_minutes > 0);
  if (active.length === 0) {
    return <span className="text-muted-foreground">No credits</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {active.map((c) => {
        const name = c.resource_types?.name ?? "Unknown";
        return (
          <span
            key={c.resource_type_id}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
          >
            {c.is_unlimited ? (
              <>
                <Infinity className="h-3 w-3 shrink-0" />
                {name}
              </>
            ) : (
              <>
                <Clock className="h-3 w-3 shrink-0" />
                {Math.round(c.monthly_minutes / 60)}h {name.toLowerCase()}
              </>
            )}
          </span>
        );
      })}
    </div>
  );
}

export function PlansTable({
  plans,
  resourceTypes,
  defaultCurrency,
}: PlansTableProps) {
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const nextSortOrder =
    plans.length > 0
      ? Math.max(...plans.map((p) => p.sort_order ?? 0)) + 10
      : 10;

  function handleToggleActive(planId: string, active: boolean) {
    startTransition(async () => {
      await togglePlanActive(planId, active);
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startTransition(async () => {
      const result = await deletePlan(deleteTarget.id);
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
          <h1 className="text-2xl font-semibold tracking-tight">
            Plans & Pricing
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define membership tiers and credit allowances for your space.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="default">
          <Plus className="mr-1.5 h-4 w-4" />
          Create Plan
        </Button>
      </div>

      {plans.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <CreditCard className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-base font-medium">No plans yet</h3>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            Plans define what your members pay and what access and credits they
            receive. Create your first plan to start accepting members.
          </p>
          <Button onClick={() => setCreateOpen(true)} className="mt-5">
            <Plus className="mr-1.5 h-4 w-4" />
            Create your first plan
          </Button>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[200px]">Plan</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead className="w-20 text-center">Active</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => {
                const isActive = plan.active !== false;
                const accessCfg = ACCESS_CONFIG[plan.access_type] ??
                  ACCESS_CONFIG.none!;

                return (
                  <TableRow
                    key={plan.id}
                    className={!isActive ? "bg-muted/30" : ""}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{plan.name}</span>
                            {!isActive && (
                              <Badge variant="outline" className="text-[10px] leading-none px-1.5 py-0.5">
                                Paused
                              </Badge>
                            )}
                          </div>
                          {plan.has_fixed_desk && (
                            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <Armchair className="h-3 w-3" />
                              Fixed desk included
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="text-base font-semibold tabular-nums">
                          {formatPrice(plan.price_cents, plan.currency)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          /mo
                        </span>
                      </div>
                      {plan.iva_rate > 0 && (
                        <span className="text-[11px] text-muted-foreground">
                          +{plan.iva_rate}% tax
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-0.5 text-xs font-medium ${accessCfg.className}`}
                      >
                        {plan.access_type === "twenty_four_seven" && (
                          <Zap className="h-3 w-3" />
                        )}
                        {accessCfg.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <CreditPills configs={plan.plan_credit_config} />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={isActive}
                        onCheckedChange={(checked) =>
                          handleToggleActive(plan.id, checked)
                        }
                        disabled={isPending}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-xs"
                            />
                          }
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setEditPlan(plan)}
                          >
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Edit plan
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(plan)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Delete plan
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
      <PlanForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        resourceTypes={resourceTypes}
        defaultCurrency={defaultCurrency}
        nextSortOrder={nextSortOrder}
      />

      {/* Edit dialog */}
      {editPlan && (
        <PlanForm
          open={true}
          onOpenChange={(open) => {
            if (!open) setEditPlan(null);
          }}
          plan={{
            ...editPlan,
            plan_credit_config: editPlan.plan_credit_config.map((cc) => ({
              resource_type_id: cc.resource_type_id,
              monthly_minutes: cc.monthly_minutes,
              is_unlimited: cc.is_unlimited,
            })),
          }}
          resourceTypes={resourceTypes}
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
            <AlertDialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this plan and its credit
              configuration. This action cannot be undone.
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
              {isPending ? "Deleting..." : "Delete plan"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
