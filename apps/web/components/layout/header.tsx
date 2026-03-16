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
    <header className="relative z-30 flex h-14 items-center justify-between border-b border-[var(--glass-border)] bg-[var(--glass-bg-heavy)] px-4 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <MobileNav
          spaceRole={spaceRole}
          spaceName={spaceName}
          logoUrl={logoUrl}
        />
        <span className="text-sm font-semibold text-foreground lg:hidden">
          {spaceName}
        </span>
      </div>
      <UserMenu userEmail={userEmail} spaceRole={spaceRole} />
    </header>
  );
}
