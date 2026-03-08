import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandingForm } from "./branding-form";
import { OperationsForm } from "./operations-form";
import { FiscalForm } from "./fiscal-form";
import { FeaturesForm } from "./features-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const spaceId = user?.app_metadata?.space_id as string | undefined;
  if (!spaceId) return <p>No space context</p>;

  const { data: space } = await supabase
    .from("spaces")
    .select("*")
    .eq("id", spaceId)
    .single();

  if (!space) return <p>Space not found</p>;

  const features = (space.features as Record<string, boolean> | null) ?? {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Space Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your space configuration.</p>
      </div>

      <Tabs defaultValue="branding">
        <TabsList>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="mt-6">
          <BrandingForm space={space} />
        </TabsContent>

        <TabsContent value="operations" className="mt-6">
          <OperationsForm space={space} />
        </TabsContent>

        <TabsContent value="fiscal" className="mt-6">
          <FiscalForm space={space} />
        </TabsContent>

        <TabsContent value="features" className="mt-6">
          <FeaturesForm features={features} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
