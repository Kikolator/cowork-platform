import { KeyRound, Clock, Shield, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const ACCESS_LABELS: Record<string, string> = {
  business_hours: "Business Hours",
  extended: "Extended Hours",
  twenty_four_seven: "24/7 Access",
  none: "No Access",
};

export default async function AccessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const spaceId = user.app_metadata?.space_id as string | undefined;
  if (!spaceId) return <p>No space context</p>;

  // Fetch member with their plan's access_type
  const { data: member } = await supabase
    .from("members")
    .select("id, access_code, has_twenty_four_seven, plans!inner(access_type)")
    .eq("user_id", user.id)
    .eq("space_id", spaceId)
    .maybeSingle();

  if (!member) {
    // Check if user has an active or upcoming pass
    const { data: activePass } = await supabase
      .from("passes")
      .select("id")
      .eq("user_id", user.id)
      .eq("space_id", spaceId)
      // "upcoming" status added by pass-lifecycle migration; safe to remove cast after types regenerated
      .in("status", ["active", "upcoming"] as unknown as ("active")[])
      .limit(1)
      .maybeSingle();

    if (activePass) {
      // Pass holders get business-hours access code
      const { data: accessConfigs } = await supabase.rpc(
        "get_member_access_config",
        { p_space_id: spaceId },
      );
      const passAccessConfig = accessConfigs?.[0] ?? null;

      const passCode =
        passAccessConfig?.enabled && passAccessConfig.mode === "manual"
          ? passAccessConfig.code_business_hours
          : null;

      return (
        <div className="mx-auto max-w-lg space-y-6 py-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Access</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your door access information for this space.
            </p>
          </div>

          {/* Access level card */}
          <div className="rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Access Level
            </div>
            <p className="mt-2 text-lg font-medium">Business Hours (Pass)</p>
          </div>

          {/* Door code card */}
          {!passAccessConfig?.enabled ? (
            <div className="rounded-xl border border-border bg-muted/30 p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Info className="h-4 w-4 shrink-0" />
                Access codes are not configured for this space. Contact your
                space administrator for access information.
              </div>
            </div>
          ) : passCode ? (
            <div className="rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <KeyRound className="h-3.5 w-3.5" />
                Door Code
              </div>
              <p className="mt-3 text-center font-mono text-4xl font-bold tracking-[0.3em]">
                {passCode}
              </p>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Business Hours code
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-muted/30 p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <KeyRound className="h-4 w-4 shrink-0" />
                No access code assigned. Contact your space administrator.
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-lg space-y-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Access</h1>
        <p className="text-sm text-muted-foreground">
          You don&apos;t have an active membership in this space.
        </p>
      </div>
    );
  }

  // Fetch space access config via safe RPC (excludes nuki_api_token)
  const { data: accessConfigs } = await supabase
    .rpc("get_member_access_config", { p_space_id: spaceId });
  const accessConfig = accessConfigs?.[0] ?? null;

  const plan = member.plans as unknown as { access_type: string };
  const accessType = member.has_twenty_four_seven ? "twenty_four_seven" : plan.access_type;
  const accessLabel = ACCESS_LABELS[accessType] ?? accessType;

  // Resolve effective code: member override > general tier code
  let effectiveCode: string | null = null;
  let codeSource: string | null = null;

  if (!accessConfig?.enabled) {
    // Access codes not enabled
  } else if (member.access_code) {
    effectiveCode = member.access_code;
    codeSource = accessConfig.mode === "nuki" ? "Nuki" : "Individual";
  } else if (accessConfig.mode === "manual") {
    // Use general code for this access tier
    switch (accessType) {
      case "twenty_four_seven":
        effectiveCode = accessConfig.code_twenty_four_seven;
        break;
      case "extended":
        effectiveCode = accessConfig.code_extended ?? accessConfig.code_twenty_four_seven;
        break;
      case "business_hours":
        effectiveCode = accessConfig.code_business_hours;
        break;
    }
    if (effectiveCode) codeSource = "General";
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your door access information for this space.
        </p>
      </div>

      {/* Access level card */}
      <div className="rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Access Level
        </div>
        <p className="mt-2 text-lg font-medium">{accessLabel}</p>
      </div>

      {/* Door code card */}
      {!accessConfig?.enabled ? (
        <div className="rounded-xl border border-border bg-muted/30 p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4 shrink-0" />
            Access codes are not configured for this space. Contact your space administrator for access information.
          </div>
        </div>
      ) : accessType === "none" ? (
        <div className="rounded-xl border border-border bg-muted/30 p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4 shrink-0" />
            Your current plan does not include physical access.
          </div>
        </div>
      ) : effectiveCode ? (
        <div className="rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <KeyRound className="h-3.5 w-3.5" />
            Door Code
          </div>
          <p className="mt-3 text-center font-mono text-4xl font-bold tracking-[0.3em]">
            {effectiveCode}
          </p>
          {codeSource && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {codeSource === "Nuki" ? "Personal keypad code" : `${accessLabel} code`}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-muted/30 p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <KeyRound className="h-4 w-4 shrink-0" />
            No access code assigned. Contact your space administrator.
          </div>
        </div>
      )}
    </div>
  );
}
