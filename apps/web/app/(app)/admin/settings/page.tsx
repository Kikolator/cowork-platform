import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandingForm } from "./branding-form";
import { OperationsForm } from "./operations-form";
import { FiscalForm } from "./fiscal-form";
import { FeaturesForm } from "./features-form";
import { AccessForm } from "./access-form";
import { ClosuresForm } from "./closures-form";
import { StripeConnect } from "./stripe-connect";
import { DomainForm } from "./domain-form";
import { getEffectiveFeePercent } from "@/lib/stripe/fees";

const VALID_TABS = ["branding", "domain", "operations", "closures", "fiscal", "features", "access", "payments"] as const;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tabParam = typeof params.tab === "string" ? params.tab : undefined;
  const defaultTab = VALID_TABS.includes(tabParam as (typeof VALID_TABS)[number])
    ? tabParam!
    : "branding";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const spaceId = user?.app_metadata?.space_id as string | undefined;
  if (!spaceId) return <p>No space context</p>;

  const tenantId = user?.app_metadata?.tenant_id as string | undefined;

  const { data: space } = await supabase
    .from("spaces")
    .select("*")
    .eq("id", spaceId)
    .single();

  if (!space) return <p>Space not found</p>;

  // Fetch tenant Stripe status
  let stripeAccountId: string | null = null;
  let stripeOnboardingComplete = false;

  let platformFeePercent = 5;

  if (tenantId) {
    const admin = createAdminClient();
    const { data: tenant } = await admin
      .from("tenants")
      .select("stripe_account_id, stripe_onboarding_complete, platform_plan, platform_fee_percent")
      .eq("id", tenantId)
      .single();

    stripeAccountId = tenant?.stripe_account_id ?? null;
    stripeOnboardingComplete = tenant?.stripe_onboarding_complete ?? false;
    platformFeePercent = getEffectiveFeePercent(
      tenant?.platform_plan ?? "free",
      tenant?.platform_fee_percent ?? null,
    );
  }

  const features = (space.features as Record<string, boolean> | null) ?? {};

  // Fetch closures
  const { data: closures } = await supabase
    .from("space_closures")
    .select("id, date, reason")
    .eq("space_id", spaceId)
    .order("date", { ascending: true });

  // Fetch access config
  const { data: accessConfig } = await supabase
    .from("space_access_config")
    .select("*")
    .eq("space_id", spaceId)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Space Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your space configuration.</p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="domain">Domain</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="closures">Closures</TabsTrigger>
          <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="access">Access</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="mt-6">
          <BrandingForm
            space={{
              ...space,
              // header_logo_mode added by migration; not yet in generated types
              header_logo_mode: (space as Record<string, unknown>).header_logo_mode as string | null ?? null,
            }}
          />
        </TabsContent>

        <TabsContent value="domain" className="mt-6">
          <DomainForm
            customDomain={space.custom_domain}
            domainStatus={(space as Record<string, unknown>).domain_status as string | null ?? null}
          />
        </TabsContent>

        <TabsContent value="operations" className="mt-6">
          <OperationsForm
            space={{
              ...space,
              // New columns added by pass_product_config migration; not yet in generated types
              max_pass_desks: (space as Record<string, unknown>).max_pass_desks as number | null,
              community_rules_text: (space as Record<string, unknown>).community_rules_text as string | null,
            }}
          />
        </TabsContent>

        <TabsContent value="closures" className="mt-6">
          <ClosuresForm closures={closures ?? []} />
        </TabsContent>

        <TabsContent value="fiscal" className="mt-6">
          <FiscalForm space={space} />
        </TabsContent>

        <TabsContent value="features" className="mt-6">
          <FeaturesForm features={features} />
        </TabsContent>

        <TabsContent value="access" className="mt-6">
          <AccessForm
            config={accessConfig ? {
              ...accessConfig,
              // WiFi columns from pass_product_config migration; not yet in generated types
              wifi_network: (accessConfig as Record<string, unknown>).wifi_network as string | null ?? null,
              wifi_password: (accessConfig as Record<string, unknown>).wifi_password as string | null ?? null,
            } : null}
          />
        </TabsContent>

        <TabsContent value="payments" className="mt-6">
          <StripeConnect
            stripeAccountId={stripeAccountId}
            stripeOnboardingComplete={stripeOnboardingComplete}
            platformFeePercent={platformFeePercent}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
