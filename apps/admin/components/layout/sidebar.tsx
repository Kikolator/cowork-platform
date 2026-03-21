"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  DollarSign,
  FileText,
  BarChart3,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Tenants", href: "/tenants", icon: Building2 },
  { label: "Revenue", href: "/revenue", icon: DollarSign },
  { label: "Invoices", href: "/invoices", icon: FileText },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Admins", href: "/admins", icon: Shield },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-sidebar">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-display text-lg font-bold text-sidebar-foreground">
            RogueOps
          </span>
          <span className="rounded-md bg-sidebar-accent px-1.5 py-0.5 font-mono text-[10px] font-medium text-sidebar-accent-foreground">
            ADMIN
          </span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
