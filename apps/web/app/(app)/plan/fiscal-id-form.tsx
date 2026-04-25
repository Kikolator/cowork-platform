"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { subscribeToPlan } from "./actions";

const FISCAL_ID_TYPES = [
  { value: "nif", label: "NIF" },
  { value: "nie", label: "NIE" },
  { value: "passport", label: "Passport" },
  { value: "cif", label: "CIF" },
  { value: "eu_vat", label: "EU VAT" },
  { value: "foreign_tax_id", label: "Foreign Tax ID" },
  { value: "other", label: "Other" },
] as const;

interface FiscalIdFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string | null;
  onError: (msg: string) => void;
  referralCode?: string | null;
}

export function FiscalIdForm({ open, onOpenChange, planId, onError, referralCode }: FiscalIdFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [entityType, setEntityType] = useState("individual");
  const [fiscalIdType, setFiscalIdType] = useState("nif");
  const [fiscalId, setFiscalId] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyTaxIdType, setCompanyTaxIdType] = useState("cif");
  const [companyTaxId, setCompanyTaxId] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fiscalId.trim()) {
      setError("Fiscal ID is required");
      return;
    }

    if (!planId) {
      setError("No plan selected");
      return;
    }

    startTransition(async () => {
      const result = await subscribeToPlan(planId, {
        billingEntityType: entityType,
        fiscalIdType,
        fiscalId: fiscalId.trim(),
        billingName: entityType === "individual" ? fullName.trim() || undefined : undefined,
        companyName: entityType === "company" ? companyName.trim() : undefined,
        companyTaxId: entityType === "company" ? companyTaxId.trim() : undefined,
        companyTaxIdType: entityType === "company" ? companyTaxIdType : undefined,
        billingAddressLine1: addressLine1.trim() || undefined,
        billingAddressLine2: addressLine2.trim() || undefined,
        billingCity: city.trim() || undefined,
        billingPostalCode: postalCode.trim() || undefined,
        billingCountry: country.trim() || undefined,
      }, referralCode ?? undefined);

      if (!result.success) {
        if (result.error === "fiscal_id_required") {
          setError("Please provide a valid fiscal ID");
        } else {
          onError(result.error);
          onOpenChange(false);
        }
        return;
      }

      window.location.href = result.url;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Billing Information Required</DialogTitle>
          <DialogDescription>
            Please provide your billing details before subscribing. This is required by law in your region.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="entity-type">Entity Type</Label>
              <Select value={entityType} onValueChange={(v) => v && setEntityType(v)} items={[{ value: "individual", label: "Individual" }, { value: "company", label: "Company" }]}>
                <SelectTrigger id="entity-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fiscal-id-type">Fiscal ID Type</Label>
              <Select value={fiscalIdType} onValueChange={(v) => v && setFiscalIdType(v)} items={FISCAL_ID_TYPES.map((t) => ({ value: t.value, label: t.label }))}>
                <SelectTrigger id="fiscal-id-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FISCAL_ID_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fiscal-id">Fiscal ID</Label>
            <Input
              id="fiscal-id"
              value={fiscalId}
              onChange={(e) => setFiscalId(e.target.value)}
              placeholder="Enter your fiscal ID"
            />
          </div>

          {entityType === "individual" && (
            <div className="space-y-2">
              <Label htmlFor="full-name">Full name</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="As shown on your ID"
              />
            </div>
          )}

          {entityType === "company" && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Company name"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company-tax-id-type">Company Tax ID Type</Label>
                  <Select value={companyTaxIdType} onValueChange={(v) => v && setCompanyTaxIdType(v)} items={FISCAL_ID_TYPES.map((t) => ({ value: t.value, label: t.label }))}>
                    <SelectTrigger id="company-tax-id-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FISCAL_ID_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-tax-id">Company Tax ID</Label>
                  <Input
                    id="company-tax-id"
                    value={companyTaxId}
                    onChange={(e) => setCompanyTaxId(e.target.value)}
                    placeholder="CIF or tax ID"
                  />
                </div>
              </div>
            </>
          )}

          <Separator />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="address-line1">Address line 1</Label>
              <Input
                id="address-line1"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="Street address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-line2">Address line 2</Label>
              <Input
                id="address-line2"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="Apt, suite, etc."
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postal-code">Postal code</Label>
              <Input
                id="postal-code"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="ES"
                maxLength={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Processing..." : "Subscribe"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
