import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage() {
  const headersList = await headers();
  const isPlatform = headersList.get("x-platform-mode") === "true";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isPlatform) {
    // Platform domain — go to spaces list (or login if not authed)
    redirect(user ? "/spaces" : "/login");
  }

  // Space domain
  redirect(user ? "/dashboard" : "/login");
}
