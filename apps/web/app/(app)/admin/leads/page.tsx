import { createClient } from "@/lib/supabase/server";
import { LeadsTable } from "./leads-table";

export default async function LeadsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: leads } = await supabase
    .from("leads")
    .select(
      "id, email, full_name, phone, company, status, source, trial_date, trial_confirmed, converted_user_id, last_contacted_at, follow_up_count, admin_notes, created_at, updated_at, archived_at"
    )
    .order("created_at", { ascending: false });

  return <LeadsTable leads={leads ?? []} />;
}
