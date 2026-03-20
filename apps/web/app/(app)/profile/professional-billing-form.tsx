"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { professionalBillingSchema, type ProfessionalBillingValues } from "./schemas";
import { updateProfileMember } from "./actions";

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

interface ProfessionalBillingFormProps {
  memberId: string;
  member: {
    company: string | null;
    role_title: string | null;
    billing_entity_type: string | null;
    fiscal_id_type: string | null;
    fiscal_id: string | null;
    billing_company_name: string | null;
    billing_company_tax_id_type: string | null;
    billing_company_tax_id: string | null;
    billing_address_line1: string | null;
    billing_address_line2: string | null;
    billing_city: string | null;
    billing_postal_code: string | null;
    billing_state_province: string | null;
    billing_country: string | null;
  };
}

export function ProfessionalBillingForm({ memberId, member }: ProfessionalBillingFormProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
  } = useForm<ProfessionalBillingValues>({
    resolver: zodResolver(professionalBillingSchema),
    defaultValues: {
      company: member.company ?? null,
      roleTitle: member.role_title ?? null,
      billingEntityType: (member.billing_entity_type as ProfessionalBillingValues["billingEntityType"]) ?? "individual",
      fiscalIdType: member.fiscal_id_type ?? null,
      fiscalId: member.fiscal_id ?? null,
      billingCompanyName: member.billing_company_name ?? null,
      billingCompanyTaxIdType: member.billing_company_tax_id_type ?? null,
      billingCompanyTaxId: member.billing_company_tax_id ?? null,
      billingAddressLine1: member.billing_address_line1 ?? null,
      billingAddressLine2: member.billing_address_line2 ?? null,
      billingCity: member.billing_city ?? null,
      billingPostalCode: member.billing_postal_code ?? null,
      billingStateProvince: member.billing_state_province ?? null,
      billingCountry: member.billing_country ?? null,
    },
  });

  const watchBillingEntityType = watch("billingEntityType");
  const watchFiscalIdType = watch("fiscalIdType");
  const watchBillingCompanyTaxIdType = watch("billingCompanyTaxIdType");

  function onSubmit(data: ProfessionalBillingValues) {
    setServerError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateProfileMember(memberId, data);
      if (!result.success) {
        setServerError(result.error);
      } else {
        setSuccess(true);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {serverError && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {serverError}
        </p>
      )}
      {success && !serverError && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          Details updated.
        </p>
      )}

      <FormSection title="Professional">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="prof-company">Company</Label>
            <Input id="prof-company" {...register("company")} placeholder="Acme Inc." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prof-roleTitle">Role / Title</Label>
            <Input id="prof-roleTitle" {...register("roleTitle")} placeholder="Software Engineer" />
          </div>
        </div>
      </FormSection>

      <Separator />

      <FormSection title="Billing">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Entity type</Label>
            <Select
              value={watchBillingEntityType}
              onValueChange={(v) => {
                if (v) setValue("billingEntityType", v as ProfessionalBillingValues["billingEntityType"]);
              }}
              items={BILLING_ENTITY_TYPES.map((t) => ({ value: t.value, label: t.label }))}
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
                setValue("fiscalIdType", v === "__none__" ? null : v);
              }}
              items={[{ value: "__none__", label: "None" }, ...FISCAL_ID_TYPES.map((t) => ({ value: t.value, label: t.label }))]}
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
            <Label htmlFor="prof-fiscalId">Fiscal ID</Label>
            <Input id="prof-fiscalId" {...register("fiscalId")} />
          </div>
        )}

        {watchBillingEntityType === "company" && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="prof-billingCompanyName">Company name</Label>
              <Input id="prof-billingCompanyName" {...register("billingCompanyName")} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Company tax ID type</Label>
                <Select
                  value={watchBillingCompanyTaxIdType ?? "__none__"}
                  onValueChange={(v) => {
                    setValue("billingCompanyTaxIdType", v === "__none__" ? null : v);
                  }}
                  items={[{ value: "__none__", label: "None" }, ...FISCAL_ID_TYPES.map((t) => ({ value: t.value, label: t.label }))]}
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
                <Label htmlFor="prof-billingCompanyTaxId">Company tax ID</Label>
                <Input id="prof-billingCompanyTaxId" {...register("billingCompanyTaxId")} />
              </div>
            </div>
          </>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="prof-billingAddressLine1">Address line 1</Label>
            <Input id="prof-billingAddressLine1" {...register("billingAddressLine1")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prof-billingAddressLine2">Address line 2</Label>
            <Input id="prof-billingAddressLine2" {...register("billingAddressLine2")} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="prof-billingCity">City</Label>
            <Input id="prof-billingCity" {...register("billingCity")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prof-billingPostalCode">Postal code</Label>
            <Input id="prof-billingPostalCode" {...register("billingPostalCode")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prof-billingCountry">Country</Label>
            <Input
              id="prof-billingCountry"
              {...register("billingCountry")}
              placeholder="ES"
              maxLength={2}
            />
          </div>
        </div>
      </FormSection>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save Details"}
        </Button>
      </div>
    </form>
  );
}
