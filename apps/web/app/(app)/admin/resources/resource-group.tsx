"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
import { deleteResource, updateResourceStatus, deleteResourceType } from "./actions";
import { ResourceForm } from "./resource-form";
import { ResourceTypeForm } from "./resource-type-form";

interface Resource {
  id: string;
  name: string;
  status: string;
  capacity: number | null;
  floor: number | null;
  sort_order: number | null;
  resource_type_id: string;
  image_url: string | null;
}

interface ResourceTypeData {
  id: string;
  name: string;
  slug: string;
  bookable: boolean | null;
  billable: boolean | null;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  available: {
    label: "Available",
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  occupied: {
    label: "Occupied",
    className: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  out_of_service: {
    label: "Out of Service",
    className: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
};

const STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "occupied", label: "Occupied" },
  { value: "out_of_service", label: "Out of Service" },
] as const;

interface ResourceGroupProps {
  resourceType: ResourceTypeData;
  resources: Resource[];
  spaceId: string;
  currentRate?: { rate_cents: number };
}

export function ResourceGroup({ resourceType, resources, spaceId, currentRate }: ResourceGroupProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [editResource, setEditResource] = useState<Resource | null>(null);
  const [editTypeOpen, setEditTypeOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Resource | null>(null);
  const [deleteTypeOpen, setDeleteTypeOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const nextSortOrder = resources.length > 0
    ? Math.max(...resources.map((r) => r.sort_order ?? 0)) + 1
    : 1;

  const isDesk = resourceType.slug === "desk";
  const defaultCapacity = isDesk ? 1 : 4;

  function handleStatusChange(resourceId: string, status: "available" | "occupied" | "out_of_service") {
    startTransition(async () => {
      await updateResourceStatus(resourceId, status);
    });
  }

  function handleDeleteResource() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteResource(deleteTarget.id);
      if (!result.success) {
        setDeleteError(result.error);
      } else {
        setDeleteTarget(null);
      }
    });
  }

  function handleDeleteType() {
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteResourceType(resourceType.id);
      if (!result.success) {
        setDeleteError(result.error);
      } else {
        setDeleteTypeOpen(false);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          {resourceType.name}{" "}
          <span className="text-muted-foreground">({resources.length})</span>
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditTypeOpen(true)}>
            Edit Type
          </Button>
          {resources.length === 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteTypeOpen(true)}
            >
              Delete Type
            </Button>
          )}
        </div>
      </div>

      {resources.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                {!isDesk && <TableHead>Capacity</TableHead>}
                <TableHead>Floor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {resources.map((resource) => {
                const statusStyle = STATUS_STYLES[resource.status] ?? STATUS_STYLES.available;
                return (
                  <TableRow key={resource.id}>
                    <TableCell className="font-medium">{resource.name}</TableCell>
                    {!isDesk && <TableCell>{resource.capacity ?? 1}</TableCell>}
                    <TableCell>{resource.floor ?? 0}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-md border border-transparent px-2 py-0.5 text-xs font-medium ${statusStyle!.className}`}
                      >
                        {statusStyle!.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="ghost" size="icon-xs" />}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditResource(resource)}>
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {STATUS_OPTIONS.filter((s) => s.value !== resource.status).map((s) => (
                            <DropdownMenuItem
                              key={s.value}
                              onClick={() => handleStatusChange(resource.id, s.value)}
                            >
                              Set {s.label}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(resource)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Delete
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
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card p-4 text-center text-sm text-muted-foreground">
          No {resourceType.name.toLowerCase()} resources yet.
        </div>
      )}

      <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add {resourceType.name}
      </Button>

      {/* Add resource dialog */}
      <ResourceForm
        open={addOpen}
        onOpenChange={setAddOpen}
        resourceTypeId={resourceType.id}
        resourceTypeName={resourceType.name}
        nextSortOrder={nextSortOrder}
        defaultCapacity={defaultCapacity}
        spaceId={spaceId}
      />

      {/* Edit resource dialog */}
      {editResource && (
        <ResourceForm
          open={true}
          onOpenChange={(open) => { if (!open) setEditResource(null); }}
          resourceTypeId={resourceType.id}
          resourceTypeName={resourceType.name}
          resource={editResource}
          nextSortOrder={nextSortOrder}
          defaultCapacity={defaultCapacity}
          spaceId={spaceId}
        />
      )}

      {/* Edit resource type dialog */}
      <ResourceTypeForm
        open={editTypeOpen}
        onOpenChange={setEditTypeOpen}
        resourceType={resourceType}
        currentRate={currentRate}
      />

      {/* Delete resource confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteError(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this resource. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button onClick={handleDeleteResource} disabled={isPending} variant="destructive">
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete resource type confirmation */}
      <AlertDialog open={deleteTypeOpen} onOpenChange={(open) => { if (!open) { setDeleteTypeOpen(false); setDeleteError(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{resourceType.name}&rdquo; type?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the resource type and its rate configuration. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button onClick={handleDeleteType} disabled={isPending} variant="destructive">
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
