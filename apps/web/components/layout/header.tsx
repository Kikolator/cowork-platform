"use client";

import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";

interface HeaderProps {
  spaceName: string;
  logoUrl: string | null;
  logoDarkUrl?: string | null;
  userEmail: string;
  spaceRole: string;
  userAvatarUrl: string | null;
}

export function Header({
  spaceName,
  logoUrl,
  logoDarkUrl,
  userEmail,
  spaceRole,
  userAvatarUrl,
}: HeaderProps) {
  return (
    <header className="relative z-30 flex h-14 items-center justify-between border-b border-[var(--glass-border)] bg-[var(--glass-bg-heavy)] px-4 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <MobileNav
          spaceRole={spaceRole}
          spaceName={spaceName}
          logoUrl={logoUrl}
          logoDarkUrl={logoDarkUrl}
        />
        <span className="text-sm font-semibold text-foreground lg:hidden">
          {spaceName}
        </span>
      </div>
      <UserMenu userEmail={userEmail} spaceRole={spaceRole} avatarUrl={userAvatarUrl} />
    </header>
  );
}
