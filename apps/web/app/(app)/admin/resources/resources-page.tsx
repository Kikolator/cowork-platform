"use client";

import { useState } from "react";
import { Plus, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResourceGroup } from "./resource-group";
import { ResourceTypeForm } from "./resource-type-form";

interface ResourceType {
  id: string;
  name: string;
  slug: string;
  bookable: boolean | null;
  billable: boolean | null;
}

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

interface ResourcesPageProps {
  resourceTypes: ResourceType[];
  resources: Resource[];
  spaceId: string;
}

export function ResourcesPage({ resourceTypes, resources, spaceId }: ResourcesPageProps) {
  const [addTypeOpen, setAddTypeOpen] = useState(false);

  const grouped = resourceTypes.map((rt) => ({
    resourceType: rt,
    resources: resources.filter((r) => r.resource_type_id === rt.id),
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Resources</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {resources.length} resources across {resourceTypes.length} types
          </p>
        </div>
        <Button variant="outline" onClick={() => setAddTypeOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Resource Type
        </Button>
      </div>

      {grouped.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <Boxes className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-base font-medium">No resource types configured</h3>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            Resource types define categories like desks, meeting rooms, or phone booths.
            Add one to start managing your space inventory.
          </p>
          <Button onClick={() => setAddTypeOpen(true)} className="mt-5">
            <Plus className="mr-1.5 h-4 w-4" />
            Add your first resource type
          </Button>
        </div>
      ) : (
        grouped.map(({ resourceType, resources: groupResources }) => (
          <ResourceGroup
            key={resourceType.id}
            resourceType={resourceType}
            resources={groupResources}
            spaceId={spaceId}
          />
        ))
      )}

      <ResourceTypeForm
        open={addTypeOpen}
        onOpenChange={setAddTypeOpen}
      />
    </div>
  );
}
