import { createAdminClient } from "@/lib/supabase/admin";
import { AddAdminForm } from "./add-admin-form";
import { RemoveAdminButton } from "./remove-admin-button";

async function getPlatformAdmins() {
  const db = createAdminClient();

  const { data: admins } = await db
    .from("platform_admins")
    .select("user_id, created_at")
    .order("created_at", { ascending: true });

  if (!admins || admins.length === 0) return [];

  const userIds = admins.map((a) => a.user_id);
  const { data: profiles } = await db
    .from("shared_profiles")
    .select("id, email, full_name")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p])
  );

  return admins.map((a) => ({
    userId: a.user_id,
    createdAt: a.created_at,
    email: profileMap.get(a.user_id)?.email ?? "Unknown",
    fullName: profileMap.get(a.user_id)?.full_name ?? null,
  }));
}

export default async function AdminsPage() {
  const admins = await getPlatformAdmins();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Platform Admins
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage who has access to this admin dashboard
        </p>
      </div>

      <AddAdminForm />

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Admin
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Added
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => (
              <tr
                key={admin.userId}
                className="border-b border-border/50"
              >
                <td className="px-4 py-3">
                  <p className="font-medium">
                    {admin.fullName ?? admin.email}
                  </p>
                  {admin.fullName && (
                    <p className="text-xs text-muted-foreground">
                      {admin.email}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : "N/A"}
                </td>
                <td className="px-4 py-3 text-right">
                  {admins.length > 1 && (
                    <RemoveAdminButton userId={admin.userId} />
                  )}
                </td>
              </tr>
            ))}
            {admins.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No platform admins configured
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
