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
  plans: { id: string; name: string }[];
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
      sendInvite: true,
    },
  });

  const watchPlanId = watch("planId");
  const watchSendInvite = watch("sendInvite");
  const planLabel = plans.find((p) => p.id === watchPlanId)?.name ?? "Select plan";

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
