"use client";

import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";

interface HeaderProps {
  spaceName: string;
  logoUrl: string | null;
  userEmail: string;
  spaceRole: string;
}

export function Header({
  spaceName,
  logoUrl,
  userEmail,
  spaceRole,
}: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-3">
        <MobileNav
          spaceRole={spaceRole}
          spaceName={spaceName}
          logoUrl={logoUrl}
        />
        <span className="text-sm font-semibold text-zinc-900 lg:hidden dark:text-zinc-50">
          {spaceName}
        </span>
      </div>
      <UserMenu userEmail={userEmail} spaceRole={spaceRole} />
    </header>
  );
}
