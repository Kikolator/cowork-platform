import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardForm } from "./onboard-form";

export default async function OnboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <OnboardForm />;
}
