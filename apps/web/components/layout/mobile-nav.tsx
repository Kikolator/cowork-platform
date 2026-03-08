"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./sidebar";

interface MobileNavProps {
  spaceRole: string;
  spaceName: string;
  logoUrl: string | null;
}

export function MobileNav({ spaceRole, spaceName, logoUrl }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100 lg:hidden dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-50 h-full w-60">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-2 top-3 rounded-md p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
            >
              <X className="h-4 w-4" />
            </button>
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
            <div onClick={() => setOpen(false)} className="h-full">
              <Sidebar
                spaceRole={spaceRole}
                spaceName={spaceName}
                logoUrl={logoUrl}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
