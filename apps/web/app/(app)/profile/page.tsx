import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PersonalForm } from "./personal-form";
import { ProfessionalBillingForm } from "./professional-billing-form";
import { NotificationsForm } from "./notifications-form";

const VALID_TABS = ["personal", "professional", "notifications"] as const;

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tabParam = typeof params.tab === "string" ? params.tab : undefined;
  const defaultTab = VALID_TABS.includes(tabParam as (typeof VALID_TABS)[number])
    ? tabParam!
    : "personal";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const spaceId = user.app_metadata?.space_id as string | undefined;
  if (!spaceId) return <p>No space context</p>;

  const [profileResult, memberResult, prefsResult] = await Promise.all([
    supabase.from("shared_profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("members")
      .select("id, company, role_title, billing_entity_type, fiscal_id_type, fiscal_id, billing_company_name, billing_company_tax_id_type, billing_company_tax_id, billing_address_line1, billing_address_line2, billing_city, billing_postal_code, billing_state_province, billing_country")
      .eq("user_id", user.id)
      .eq("space_id", spaceId)
      .maybeSingle(),
    supabase
      .from("notification_preferences")
      .select("booking_reminders, credit_warnings, marketing, weekly_summary, preferred_channel")
      .eq("user_id", user.id)
      .eq("space_id", spaceId)
      .maybeSingle(),
  ]);

  const profile = profileResult.data;
  if (!profile) return <p>Profile not found</p>;

  const member = memberResult.data;
  const prefs = prefsResult.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your personal information and preferences.</p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="professional">Professional & Billing</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-6">
          <PersonalForm profile={profile} />
        </TabsContent>

        <TabsContent value="professional" className="mt-6">
          {member ? (
            <ProfessionalBillingForm memberId={member.id} member={member} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No membership record found. Professional and billing details are available once you have an active membership.
            </p>
          )}
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <NotificationsForm preferences={prefs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
