"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "./nav-items";

interface SidebarProps {
  spaceRole: string;
  spaceName: string;
  logoUrl: string | null;
  logoDarkUrl?: string | null;
}

export function Sidebar({ spaceRole, spaceName, logoUrl, logoDarkUrl }: SidebarProps) {
  const pathname = usePathname();
  const isAdmin = spaceRole === "admin" || spaceRole === "owner";

  const memberItems = navItems.filter((item) => !item.adminOnly);
  const adminItems = navItems.filter((item) => item.adminOnly);

  return (
    <aside className="flex h-full w-60 flex-col border-r border-[var(--glass-border)] bg-[var(--glass-bg-heavy)] backdrop-blur-xl">
      {/* Space branding */}
      <div className="flex h-14 items-center gap-2 border-b border-[var(--glass-border)] px-4">
        {logoUrl ? (
          logoDarkUrl ? (
            <>
              <img
                src={logoUrl}
                alt={spaceName}
                className="h-7 w-7 rounded-lg object-cover shadow-sm dark:hidden"
              />
              <img
                src={logoDarkUrl}
                alt={spaceName}
                className="hidden h-7 w-7 rounded-lg object-cover shadow-sm dark:block"
              />
            </>
          ) : (
            <img
              src={logoUrl}
              alt={spaceName}
              className="h-7 w-7 rounded-lg object-cover shadow-sm"
            />
          )
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground shadow-sm">
            {spaceName.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="truncate font-display text-sm font-semibold text-foreground">
          {spaceName}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <NavSection items={memberItems} pathname={pathname} />

        {isAdmin && (
          <>
            <div className="mx-2 my-3 border-t border-[var(--glass-border)]" />
            <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Administration
            </p>
            <NavSection items={adminItems} pathname={pathname} />
          </>
        )}
      </nav>
    </aside>
  );
}

function NavSection({
  items,
  pathname,
}: {
  items: typeof navItems;
  pathname: string;
}) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                active
                  ? "bg-white/60 font-medium text-foreground shadow-sm dark:bg-white/10"
                  : "text-muted-foreground hover:bg-white/40 hover:text-foreground dark:hover:bg-white/5"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
