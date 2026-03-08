"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface FiscalIdFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string | null;
  onError: (msg: string) => void;
}

export function FiscalIdForm({ open, onOpenChange, planId, onError }: FiscalIdFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [entityType, setEntityType] = useState("individual");
  const [fiscalIdType, setFiscalIdType] = useState("nif");
  const [fiscalId, setFiscalId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyTaxId, setCompanyTaxId] = useState("");

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
        companyName: entityType === "company" ? companyName.trim() : undefined,
        companyTaxId: entityType === "company" ? companyTaxId.trim() : undefined,
        companyTaxIdType: entityType === "company" ? "cif" : undefined,
      });

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fiscal Information Required</DialogTitle>
          <DialogDescription>
            Please provide your fiscal ID before subscribing. This is required by law in your region.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="entity-type">Entity Type</Label>
            <Select value={entityType} onValueChange={(v) => v && setEntityType(v)}>
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
            <Label htmlFor="fiscal-id-type">ID Type</Label>
            <Select value={fiscalIdType} onValueChange={(v) => v && setFiscalIdType(v)}>
              <SelectTrigger id="fiscal-id-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nif">NIF</SelectItem>
                <SelectItem value="nie">NIE</SelectItem>
                <SelectItem value="passport">Passport</SelectItem>
                <SelectItem value="cif">CIF</SelectItem>
                <SelectItem value="eu_vat">EU VAT</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
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

          {entityType === "company" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Company name"
                />
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
            </>
          )}

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
