"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { signOut } from "@/app/(app)/dashboard/actions";
import { ThemeToggle } from "@/components/theme-toggle";

interface UserMenuProps {
  userEmail: string;
  spaceRole: string;
}

const roleBadgeClass: Record<string, string> = {
  owner:
    "bg-amber-400/15 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
  admin:
    "bg-blue-400/15 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300",
  member:
    "bg-white/40 text-muted-foreground dark:bg-white/10",
};

export function UserMenu({ userEmail, spaceRole }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-all duration-200 hover:bg-white/40 dark:hover:bg-white/10"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
          {userEmail.charAt(0).toUpperCase()}
        </div>
        <span className="hidden text-muted-foreground sm:inline">
          {userEmail}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg-heavy)] py-1 shadow-[var(--glass-shadow)] backdrop-blur-xl">
          <div className="border-b border-[var(--glass-border)] px-3 py-2">
            <p className="truncate text-sm font-medium text-foreground">
              {userEmail}
            </p>
            <span
              className={`mt-1 inline-block rounded-md px-1.5 py-0.5 text-xs font-medium ${roleBadgeClass[spaceRole] ?? roleBadgeClass.member}`}
            >
              {spaceRole}
            </span>
          </div>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/40 hover:text-foreground dark:hover:bg-white/10"
          >
            Profile
          </Link>
          <div className="border-t border-[var(--glass-border)] px-3 py-2">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Theme</p>
            <ThemeToggle />
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-white/40 hover:text-foreground dark:hover:bg-white/10"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
