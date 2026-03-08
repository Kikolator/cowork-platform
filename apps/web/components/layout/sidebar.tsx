"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "./nav-items";

interface SidebarProps {
  spaceRole: string;
  spaceName: string;
  logoUrl: string | null;
}

export function Sidebar({ spaceRole, spaceName, logoUrl }: SidebarProps) {
  const pathname = usePathname();
  const isAdmin = spaceRole === "admin" || spaceRole === "owner";

  const memberItems = navItems.filter((item) => !item.adminOnly);
  const adminItems = navItems.filter((item) => item.adminOnly);

  return (
    <aside className="flex h-full w-60 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Space branding */}
      <div className="flex h-14 items-center gap-2 border-b border-zinc-200 px-4 dark:border-zinc-800">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={spaceName}
            className="h-7 w-7 rounded object-cover"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded bg-zinc-900 text-xs font-bold text-white dark:bg-zinc-50 dark:text-zinc-900">
            {spaceName.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {spaceName}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <NavSection items={memberItems} pathname={pathname} />

        {isAdmin && (
          <>
            <div className="mx-2 my-3 border-t border-zinc-200 dark:border-zinc-800" />
            <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-zinc-400">
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
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-50"
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
