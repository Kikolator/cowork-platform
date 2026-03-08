"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { resourceSchema, type ResourceFormValues } from "./schemas";
import { createResource, updateResource } from "./actions";

interface ResourceData {
  id: string;
  name: string;
  capacity: number | null;
  floor: number | null;
  sort_order: number | null;
  resource_type_id: string;
}

interface ResourceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceTypeId: string;
  resourceTypeName: string;
  resource?: ResourceData;
  nextSortOrder: number;
  defaultCapacity: number;
}

export function ResourceForm({
  open,
  onOpenChange,
  resourceTypeId,
  resourceTypeName,
  resource,
  nextSortOrder,
  defaultCapacity,
}: ResourceFormProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!resource;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResourceFormValues>({
    resolver: zodResolver(resourceSchema),
    defaultValues: {
      name: resource?.name ?? "",
      resourceTypeId: resource?.resource_type_id ?? resourceTypeId,
      capacity: resource?.capacity ?? defaultCapacity,
      floor: resource?.floor ?? 0,
      sortOrder: resource?.sort_order ?? nextSortOrder,
    },
  });

  function onSubmit(data: ResourceFormValues) {
    setServerError(null);
    startTransition(async () => {
      const result = isEdit
        ? await updateResource(resource.id, data)
        : await createResource(data);
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
          <DialogTitle>
            {isEdit ? `Edit ${resource.name}` : `Add ${resourceTypeName}`}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the resource details below."
              : `Add a new ${resourceTypeName.toLowerCase()} to your space.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {serverError}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="res-name">Name</Label>
            <Input id="res-name" {...register("name")} placeholder={`${resourceTypeName} 1`} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="res-capacity">Capacity</Label>
              <Input
                id="res-capacity"
                type="number"
                min={1}
                {...register("capacity", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-floor">Floor</Label>
              <Input
                id="res-floor"
                type="number"
                {...register("floor", { valueAsNumber: true })}
              />
            </div>
          </div>

          <input type="hidden" {...register("resourceTypeId")} />
          <input type="hidden" {...register("sortOrder", { valueAsNumber: true })} />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : isEdit ? "Save Changes" : `Add ${resourceTypeName}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
