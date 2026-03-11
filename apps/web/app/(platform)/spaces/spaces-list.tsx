"use client";

import { Building2, Plus } from "lucide-react";
import Link from "next/link";

interface Space {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  role: string;
}

import { buildSpaceUrlClient } from "@/lib/url";

const platformDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "localhost:3000";

function spaceUrl(slug: string) {
  return buildSpaceUrlClient(slug, "/dashboard");
}

export function SpacesList({ spaces }: { spaces: Space[] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Your spaces
      </h2>
      <div className="space-y-2">
        {spaces.map((space) => (
          <a
            key={space.id}
            href={spaceUrl(space.slug)}
            className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
              {space.logo_url ? (
                <img
                  src={space.logo_url}
                  alt={space.name}
                  className="h-8 w-8 rounded-md object-cover"
                />
              ) : (
                <Building2 className="h-5 w-5 text-zinc-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-zinc-900 dark:text-zinc-50">
                {space.name}
              </p>
              <p className="text-sm text-zinc-500">
                {space.slug}.{platformDomain}
              </p>
            </div>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {space.role}
            </span>
          </a>
        ))}
      </div>
      <Link
        href="/onboard"
        className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 p-4 text-sm font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-50"
      >
        <Plus className="h-4 w-4" />
        Create a new space
      </Link>
    </div>
  );
}
