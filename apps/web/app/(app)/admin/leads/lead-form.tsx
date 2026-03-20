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
import { leadSchema, LEAD_STATUSES, LEAD_SOURCES, type LeadFormValues } from "./schemas";
import { createLead, updateLead } from "./actions";
import type { Lead } from "./leads-table";

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  invited: "Invited",
  confirmed: "Confirmed",
  completed: "Completed",
  follow_up: "Follow Up",
  converted: "Converted",
  lost: "Lost",
};

const SOURCE_LABELS: Record<string, string> = {
  website: "Website",
  manual: "Manual",
  referral: "Referral",
  walk_in: "Walk-in",
  event: "Event",
  officernd_import: "OfficeRnD Import",
};

interface LeadFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead;
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

export function LeadForm({ open, onOpenChange, lead }: LeadFormProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!lead;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      email: lead?.email ?? "",
      fullName: lead?.full_name ?? "",
      phone: lead?.phone ?? "",
      company: lead?.company ?? "",
      status: (lead?.status as LeadFormValues["status"]) ?? "new",
      source: (lead?.source as LeadFormValues["source"]) ?? "manual",
      trialDate: lead?.trial_date ?? "",
      trialConfirmed: lead?.trial_confirmed ?? false,
      adminNotes: lead?.admin_notes ?? "",
    },
  });

  const watchStatus = watch("status");
  const watchSource = watch("source");
  const watchTrialConfirmed = watch("trialConfirmed");

  function onSubmit(data: LeadFormValues) {
    setServerError(null);
    startTransition(async () => {
      const result = isEdit
        ? await updateLead(lead.id, data)
        : await createLead(data);
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
            {isEdit ? "Edit Lead" : "Add Lead"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update lead details and pipeline status."
              : "Add a new prospective member to your pipeline."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {serverError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {serverError}
            </p>
          )}

          {/* Contact Info */}
          <FormSection title="Contact Info">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...register("email")}
                  placeholder="jane@example.com"
                />
                {errors.email && (
                  <p className="text-xs text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fullName">
                  Full Name{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="fullName"
                  {...register("fullName")}
                  placeholder="Jane Smith"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="phone">
                  Phone{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="phone"
                  {...register("phone")}
                  placeholder="+34 612 345 678"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company">
                  Company{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="company"
                  {...register("company")}
                  placeholder="Acme Inc."
                />
              </div>
            </div>
          </FormSection>

          <Separator />

          {/* Pipeline */}
          <FormSection title="Pipeline">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={watchStatus}
                  onValueChange={(v) => {
                    if (v) setValue("status", v as LeadFormValues["status"]);
                  }}
                  items={LEAD_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] ?? s }))}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s] ?? s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="source">Source</Label>
                <Select
                  value={watchSource}
                  onValueChange={(v) => {
                    if (v) setValue("source", v as LeadFormValues["source"]);
                  }}
                  items={LEAD_SOURCES.map((s) => ({ value: s, label: SOURCE_LABELS[s] ?? s }))}
                >
                  <SelectTrigger id="source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SOURCE_LABELS[s] ?? s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FormSection>

          <Separator />

          {/* Trial */}
          <FormSection title="Trial">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="trialDate">
                  Trial Date{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="trialDate"
                  type="date"
                  {...register("trialDate")}
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={watchTrialConfirmed}
                    onCheckedChange={(checked) =>
                      setValue("trialConfirmed", checked === true)
                    }
                  />
                  <span className="text-sm">Trial confirmed</span>
                </label>
              </div>
            </div>
          </FormSection>

          <Separator />

          {/* Notes */}
          <FormSection title="Notes">
            <div className="space-y-1.5">
              <Label htmlFor="adminNotes">
                Admin Notes{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="adminNotes"
                {...register("adminNotes")}
                placeholder="Internal notes about this lead..."
                rows={3}
              />
            </div>
          </FormSection>

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
                  : "Add Lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
