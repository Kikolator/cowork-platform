import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PassCard } from "./pass-card";

export default async function PassesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const spaceId = user.app_metadata?.space_id as string | undefined;
  if (!spaceId) redirect("/");

  // Fetch passes and space currency in parallel
  const [{ data: passes }, { data: space }] = await Promise.all([
    supabase
      .from("passes")
      .select(
        "id, pass_type, status, start_date, end_date, amount_cents, assigned_desk_id, created_at, desk:resources!passes_assigned_desk_id_fkey(name)",
      )
      .eq("user_id", user.id)
      .eq("space_id", spaceId)
      .order("start_date", { ascending: false }),
    supabase.from("spaces").select("*").eq("id", spaceId).single(),
  ]);

  const currency = space?.currency ?? "EUR";
  const cancelBeforeHours = ((space as Record<string, unknown> | null)
    ?.pass_cancel_before_hours as number | null) ?? 24;

  // Cast nested desk relation
  const allPasses = (passes ?? []).map((p) => ({
    ...p,
    desk: p.desk as unknown as { name: string } | null,
  }));

  // Group into active/upcoming and past
  const activeStatuses = new Set(["upcoming", "active"]);
  const currentPasses = allPasses.filter((p) => activeStatuses.has(p.status));
  const pastPasses = allPasses.filter((p) => !activeStatuses.has(p.status));

  return (
    <div className="mx-auto max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Passes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View your day and week passes.
        </p>
      </div>

      {allPasses.length === 0 ? (
        <div className="mt-8 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-8 text-center shadow-[var(--glass-shadow)] backdrop-blur-xl">
          <p className="text-sm text-muted-foreground">
            You don&apos;t have any passes yet.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {/* Upcoming & Active */}
          {currentPasses.length > 0 && (
            <section>
              <h2 className="text-lg font-medium text-foreground">
                Upcoming &amp; Active
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {currentPasses.map((pass) => {
                  const hoursUntilStart =
                    (new Date(pass.start_date + "T00:00:00Z").getTime() - Date.now()) / (1000 * 60 * 60);
                  const canCancel =
                    (pass.status as string) === "upcoming" && hoursUntilStart >= cancelBeforeHours;
                  return (
                    <PassCard key={pass.id} pass={pass} currency={currency} canCancel={canCancel} />
                  );
                })}
              </div>
            </section>
          )}

          {/* Past */}
          {pastPasses.length > 0 && (
            <section>
              <h2 className="text-lg font-medium text-foreground">Past</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {pastPasses.map((pass) => (
                  <PassCard key={pass.id} pass={pass} currency={currency} canCancel={false} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
