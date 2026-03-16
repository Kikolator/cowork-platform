"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { UpdateMemberValues } from "./schemas";
import { updateMember } from "./actions";
import type { Member } from "./members-table";

const MEMBER_STATUSES = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "past_due", label: "Past Due" },
  { value: "cancelling", label: "Cancelling" },
  { value: "churned", label: "Churned" },
] as const;

const BILLING_ENTITY_TYPES = [
  { value: "individual", label: "Individual" },
  { value: "company", label: "Company" },
] as const;

const FISCAL_ID_TYPES = [
  { value: "nif", label: "NIF" },
  { value: "nie", label: "NIE" },
  { value: "cif", label: "CIF" },
  { value: "passport", label: "Passport" },
  { value: "eu_vat", label: "EU VAT" },
  { value: "foreign_tax_id", label: "Foreign Tax ID" },
  { value: "other", label: "Other" },
] as const;

function findLabel<T extends { value: string; label: string }>(
  options: readonly T[],
  value: string | null,
  fallback = "None",
): string {
  if (!value) return fallback;
  return options.find((o) => o.value === value)?.label ?? value;
}

interface MemberFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Member;
  plans: { id: string; name: string }[];
  desks: { id: string; name: string }[];
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      {children}
    </div>
  );
}

export function MemberForm({ open, onOpenChange, member, plans, desks }: MemberFormProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
  } = useForm<UpdateMemberValues>({
    defaultValues: {
      planId: member.plan_id,
      status: member.status as UpdateMemberValues["status"],
      fixedDeskId: member.fixed_desk_id ?? null,
      hasTwentyFourSeven: member.has_twenty_four_seven ?? false,
      accessCode: member.access_code ?? null,
      alarmApproved: member.alarm_approved ?? false,
      company: member.company ?? null,
      roleTitle: member.role_title ?? null,
      billingEntityType: (member.billing_entity_type as UpdateMemberValues["billingEntityType"]) ?? "individual",
      fiscalIdType: (member.fiscal_id_type as UpdateMemberValues["fiscalIdType"]) ?? null,
      fiscalId: member.fiscal_id ?? null,
      billingCompanyName: member.billing_company_name ?? null,
      billingCompanyTaxIdType: (member.billing_company_tax_id_type as UpdateMemberValues["billingCompanyTaxIdType"]) ?? null,
      billingCompanyTaxId: member.billing_company_tax_id ?? null,
      billingAddressLine1: member.billing_address_line1 ?? null,
      billingAddressLine2: member.billing_address_line2 ?? null,
      billingCity: member.billing_city ?? null,
      billingPostalCode: member.billing_postal_code ?? null,
      billingStateProvince: member.billing_state_province ?? null,
      billingCountry: member.billing_country ?? null,
    },
  });

  const watchStatus = watch("status");
  const watchPlanId = watch("planId");
  const watchFixedDeskId = watch("fixedDeskId");
  const watchHasTwentyFourSeven = watch("hasTwentyFourSeven");
  const watchAlarmApproved = watch("alarmApproved");
  const watchBillingEntityType = watch("billingEntityType");
  const watchFiscalIdType = watch("fiscalIdType");
  const watchBillingCompanyTaxIdType = watch("billingCompanyTaxIdType");

  const planLabel = plans.find((p) => p.id === watchPlanId)?.name ?? "Select plan";
  const deskLabel = watchFixedDeskId
    ? desks.find((d) => d.id === watchFixedDeskId)?.name ?? "Unknown"
    : "None";

  function onSubmit(data: UpdateMemberValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await updateMember(member.id, data);
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
          <DialogTitle>Edit Member</DialogTitle>
          <DialogDescription>
            Update membership, access, and billing details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {serverError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {serverError}
            </p>
          )}

          {/* Membership */}
          <FormSection title="Membership">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <Select
                  value={watchPlanId}
                  onValueChange={(v) => { if (v) setValue("planId", v); }}
                >
                  <SelectTrigger>
                    <SelectValue>{planLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={watchStatus}
                  onValueChange={(v) => {
                    if (v) setValue("status", v as UpdateMemberValues["status"]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue>{findLabel(MEMBER_STATUSES, watchStatus)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {MEMBER_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FormSection>

          <Separator />

          {/* Access */}
          <FormSection title="Access">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Fixed desk</Label>
                <Select
                  value={watchFixedDeskId ?? "__none__"}
                  onValueChange={(v) => {
                    setValue("fixedDeskId", v === "__none__" ? null : v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue>{deskLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {desks.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="accessCode">Access code</Label>
                <Input
                  id="accessCode"
                  {...register("accessCode")}
                  placeholder="e.g. 1234"
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50">
              <Checkbox
                checked={watchHasTwentyFourSeven}
                onCheckedChange={(checked) =>
                  setValue("hasTwentyFourSeven", checked === true)
                }
              />
              <div>
                <span className="text-sm font-medium">24/7 access</span>
                <p className="text-xs text-muted-foreground">
                  Member can access the space outside regular hours.
                </p>
              </div>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50">
              <Checkbox
                checked={watchAlarmApproved}
                onCheckedChange={(checked) =>
                  setValue("alarmApproved", checked === true)
                }
              />
              <div>
                <span className="text-sm font-medium">Alarm approved</span>
                <p className="text-xs text-muted-foreground">
                  Member knows the alarm code and procedures.
                </p>
              </div>
            </label>
          </FormSection>

          <Separator />

          {/* Professional */}
          <FormSection title="Professional">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="company">Company</Label>
                <Input id="company" {...register("company")} placeholder="Acme Inc." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="roleTitle">Role / Title</Label>
                <Input id="roleTitle" {...register("roleTitle")} placeholder="Software Engineer" />
              </div>
            </div>
          </FormSection>

          <Separator />

          {/* Billing */}
          <FormSection title="Billing">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Entity type</Label>
                <Select
                  value={watchBillingEntityType}
                  onValueChange={(v) => {
                    if (v) setValue("billingEntityType", v as UpdateMemberValues["billingEntityType"]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue>{findLabel(BILLING_ENTITY_TYPES, watchBillingEntityType)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_ENTITY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Fiscal ID type</Label>
                <Select
                  value={watchFiscalIdType ?? "__none__"}
                  onValueChange={(v) => {
                    setValue("fiscalIdType", v === "__none__" ? null : v as UpdateMemberValues["fiscalIdType"]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue>{findLabel(FISCAL_ID_TYPES, watchFiscalIdType)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {FISCAL_ID_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {watchFiscalIdType && (
              <div className="space-y-1.5">
                <Label htmlFor="fiscalId">Fiscal ID</Label>
                <Input id="fiscalId" {...register("fiscalId")} />
              </div>
            )}

            {watchBillingEntityType === "company" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="billingCompanyName">Company name</Label>
                  <Input id="billingCompanyName" {...register("billingCompanyName")} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Company tax ID type</Label>
                    <Select
                      value={watchBillingCompanyTaxIdType ?? "__none__"}
                      onValueChange={(v) => {
                        setValue(
                          "billingCompanyTaxIdType",
                          v === "__none__" ? null : v as UpdateMemberValues["billingCompanyTaxIdType"],
                        );
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue>{findLabel(FISCAL_ID_TYPES, watchBillingCompanyTaxIdType)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {FISCAL_ID_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="billingCompanyTaxId">Company tax ID</Label>
                    <Input id="billingCompanyTaxId" {...register("billingCompanyTaxId")} />
                  </div>
                </div>
              </>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="billingAddressLine1">Address line 1</Label>
                <Input id="billingAddressLine1" {...register("billingAddressLine1")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="billingAddressLine2">Address line 2</Label>
                <Input id="billingAddressLine2" {...register("billingAddressLine2")} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="billingCity">City</Label>
                <Input id="billingCity" {...register("billingCity")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="billingPostalCode">Postal code</Label>
                <Input id="billingPostalCode" {...register("billingPostalCode")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="billingCountry">Country</Label>
                <Input
                  id="billingCountry"
                  {...register("billingCountry")}
                  placeholder="ES"
                  maxLength={2}
                />
              </div>
            </div>
          </FormSection>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
