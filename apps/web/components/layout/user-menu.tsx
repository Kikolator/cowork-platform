"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { signOut } from "@/app/(app)/dashboard/actions";

interface UserMenuProps {
  userEmail: string;
  spaceRole: string;
}

const roleBadgeClass: Record<string, string> = {
  owner:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  admin:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  member:
    "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
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
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
          {userEmail.charAt(0).toUpperCase()}
        </div>
        <span className="hidden text-zinc-700 dark:text-zinc-300 sm:inline">
          {userEmail}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {userEmail}
            </p>
            <span
              className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs font-medium ${roleBadgeClass[spaceRole] ?? roleBadgeClass.member}`}
            >
              {spaceRole}
            </span>
          </div>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Profile
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
