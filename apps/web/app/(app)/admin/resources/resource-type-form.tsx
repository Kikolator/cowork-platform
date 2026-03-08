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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resourceTypeSchema, type ResourceTypeFormValues } from "./schemas";
import { createResourceType, updateResourceType } from "./actions";

interface ResourceTypeData {
  id: string;
  name: string;
  slug: string;
  bookable: boolean | null;
  billable: boolean | null;
}

interface ResourceTypeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType?: ResourceTypeData;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function ResourceTypeForm({ open, onOpenChange, resourceType }: ResourceTypeFormProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!resourceType;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ResourceTypeFormValues>({
    resolver: zodResolver(resourceTypeSchema),
    defaultValues: {
      name: resourceType?.name ?? "",
      slug: resourceType?.slug ?? "",
      bookable: resourceType?.bookable ?? true,
      billable: resourceType?.billable ?? true,
      defaultRateCents: 0,
    },
  });

  const watchBookable = watch("bookable");
  const watchBillable = watch("billable");

  function onSubmit(data: ResourceTypeFormValues) {
    setServerError(null);
    startTransition(async () => {
      const result = isEdit
        ? await updateResourceType(resourceType.id, data)
        : await createResourceType(data);
      if (!result.success) {
        setServerError(result.error);
      } else {
        onOpenChange(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Resource Type" : "Add Resource Type"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the resource type configuration."
              : "Create a new category for your bookable resources."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {serverError}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="rt-name">Name</Label>
            <Input
              id="rt-name"
              {...register("name", {
                onChange: (e) => {
                  if (!isEdit) setValue("slug", slugify(e.target.value));
                },
              })}
              placeholder="Phone Booth"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rt-slug">Slug</Label>
            <Input id="rt-slug" {...register("slug")} placeholder="phone_booth" />
            {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
          </div>

          <div className="flex items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                id="rt-bookable"
                checked={watchBookable}
                onCheckedChange={(checked) => setValue("bookable", checked === true)}
              />
              <span className="text-sm">Bookable</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                id="rt-billable"
                checked={watchBillable}
                onCheckedChange={(checked) => setValue("billable", checked === true)}
              />
              <span className="text-sm">Billable</span>
            </label>
          </div>

          {!isEdit && watchBillable && (
            <div className="space-y-1.5">
              <Label htmlFor="rt-rate">Default hourly rate (cents)</Label>
              <Input
                id="rt-rate"
                type="number"
                min={0}
                {...register("defaultRateCents", { valueAsNumber: true })}
                placeholder="500"
              />
              <p className="text-xs text-muted-foreground">e.g. 500 = €5.00/hour</p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : isEdit ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
