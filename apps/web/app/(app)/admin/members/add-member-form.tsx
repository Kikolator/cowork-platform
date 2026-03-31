"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { addMemberSchema, type AddMemberValues } from "./schemas";
import { addMember } from "./actions";

interface AddMemberFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plans: { id: string; name: string; price_cents: number; currency: string }[];
}

export function AddMemberForm({ open, onOpenChange, plans }: AddMemberFormProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AddMemberValues>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      email: "",
      fullName: "",
      phone: "",
      planId: plans[0]?.id ?? "",
      company: "",
      billingMode: "stripe",
      customPriceCents: null,
      sendInvite: true,
    },
  });

  const watchPlanId = watch("planId");
  const watchSendInvite = watch("sendInvite");
  const watchBillingMode = watch("billingMode");
  const watchCustomPrice = watch("customPriceCents");
  const selectedPlan = plans.find((p) => p.id === watchPlanId);
  const planLabel = selectedPlan?.name ?? "Select plan";

  function onSubmit(data: AddMemberValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await addMember(data);
      if (!result.success) {
        setServerError(result.error);
      } else {
        reset();
        onOpenChange(false);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Add Member</DialogTitle>
          <DialogDescription>
            Create a new member in your space.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {serverError}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="member@example.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                placeholder="Jane Doe"
                {...register("fullName")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="+34 600 000 000"
                {...register("phone")}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>
                Plan <span className="text-destructive">*</span>
              </Label>
              <Select
                value={watchPlanId}
                onValueChange={(v) => {
                  if (v) setValue("planId", v);
                }}
                items={plans.map((p) => ({ value: p.id, label: p.name }))}
              >
                <SelectTrigger>
                  <SelectValue>{planLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.planId && (
                <p className="text-xs text-destructive">{errors.planId.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                placeholder="Acme Inc."
                {...register("company")}
              />
            </div>
          </div>

          {/* Billing mode */}
          <div className="space-y-2">
            <Label>Billing</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setValue("billingMode", "stripe")}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                  watchBillingMode === "stripe"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <span className="font-medium">Stripe</span>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Invoice sent to member
                </p>
              </button>
              <button
                type="button"
                onClick={() => setValue("billingMode", "manual")}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                  watchBillingMode === "manual"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <span className="font-medium">Manual</span>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  You handle billing
                </p>
              </button>
            </div>
          </div>

          {/* Custom price */}
          <div className="space-y-1.5">
            <Label htmlFor="customPrice">
              Custom price{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (optional — overrides plan price
                {selectedPlan
                  ? ` of ${(selectedPlan.price_cents / 100).toFixed(2)} ${selectedPlan.currency.toUpperCase()}`
                  : ""}
                )
              </span>
            </Label>
            <Input
              id="customPrice"
              type="number"
              min="0"
              step="0.01"
              placeholder={
                selectedPlan
                  ? (selectedPlan.price_cents / 100).toFixed(2)
                  : "0.00"
              }
              value={
                watchCustomPrice != null
                  ? (watchCustomPrice / 100).toFixed(2)
                  : ""
              }
              onChange={(e) => {
                const val = e.target.value;
                setValue(
                  "customPriceCents",
                  val === "" ? null : Math.round(parseFloat(val) * 100),
                );
              }}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50">
            <Checkbox
              checked={watchSendInvite}
              onCheckedChange={(checked) =>
                setValue("sendInvite", checked === true)
              }
            />
            <div>
              <span className="text-sm font-medium">Send invite email</span>
              <p className="text-xs text-muted-foreground">
                Send a magic link so the member can log in immediately.
              </p>
            </div>
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding..." : "Add Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
