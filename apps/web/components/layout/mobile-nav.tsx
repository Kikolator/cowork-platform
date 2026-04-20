"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./sidebar";

interface MobileNavProps {
  spaceRole: string;
  spaceName: string;
  logoUrl: string | null;
  logoDarkUrl?: string | null;
  headerLogoMode?: "icon_and_name" | "logo_only";
}

export function MobileNav({ spaceRole, spaceName, logoUrl, logoDarkUrl, headerLogoMode }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/40 hover:text-foreground lg:hidden dark:hover:bg-white/10"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Portal to document.body so overlay escapes header stacking context */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <div className="relative z-50 h-full w-60">
              <button
                onClick={() => setOpen(false)}
                className="absolute right-2 top-3 rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
              <div onClick={() => setOpen(false)} className="h-full">
                <Sidebar
                  spaceRole={spaceRole}
                  spaceName={spaceName}
                  logoUrl={logoUrl}
                  logoDarkUrl={logoDarkUrl}
                  headerLogoMode={headerLogoMode}
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
