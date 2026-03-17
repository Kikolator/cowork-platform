import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrigin } from "@/lib/url";
import { SpacesList } from "./spaces-list";

export default async function SpacesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: spaceUsers } = await supabase
    .from("space_users")
    .select("role, spaces(id, name, slug, logo_url)")
    .eq("user_id", user.id);

  const spaces =
    spaceUsers
      ?.map((su) => {
        const space = su.spaces as unknown as {
          id: string;
          name: string;
          slug: string;
          logo_url: string | null;
        } | null;
        if (!space) return null;
        return { ...space, role: su.role };
      })
      .filter(
        (s): s is NonNullable<typeof s> => s !== null
      ) ?? [];

  if (spaces.length === 0) {
    redirect("/onboard");
  }

  const origin = getOrigin(await headers());

  return <SpacesList spaces={spaces} origin={origin} />;
}
