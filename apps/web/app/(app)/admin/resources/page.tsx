import { createClient } from "@/lib/supabase/server";
import { ResourcesPage } from "./resources-page";

export default async function Page() {
  const supabase = await createClient();

  const [{ data: resourceTypes }, { data: resources }] = await Promise.all([
    supabase
      .from("resource_types")
      .select("id, name, slug, bookable, billable")
      .order("sort_order", { ascending: true }),
    supabase
      .from("resources")
      .select("id, name, status, capacity, floor, sort_order, resource_type_id")
      .order("sort_order", { ascending: true }),
  ]);

  return (
    <ResourcesPage
      resourceTypes={resourceTypes ?? []}
      resources={resources ?? []}
    />
  );
}
