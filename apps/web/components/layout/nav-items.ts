import {
  LayoutDashboard,
  CalendarPlus,
  CalendarDays,
  ShoppingBag,
  CreditCard,
  User,
  Users,
  CalendarRange,
  UserPlus,
  Ticket,
  Box,
  Settings,
  DollarSign,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Book", href: "/book", icon: CalendarPlus },
  { label: "My Bookings", href: "/bookings", icon: CalendarDays },
  { label: "Store", href: "/store", icon: ShoppingBag },
  { label: "My Plan", href: "/plan", icon: CreditCard },
  { label: "Profile", href: "/profile", icon: User },

  {
    label: "Members",
    href: "/admin/members",
    icon: Users,
    adminOnly: true,
  },
  {
    label: "All Bookings",
    href: "/admin/bookings",
    icon: CalendarRange,
    adminOnly: true,
  },
  { label: "Leads", href: "/admin/leads", icon: UserPlus, adminOnly: true },
  { label: "Passes", href: "/admin/passes", icon: Ticket, adminOnly: true },
  {
    label: "Resources",
    href: "/admin/resources",
    icon: Box,
    adminOnly: true,
  },
  {
    label: "Plans & Pricing",
    href: "/admin/plans",
    icon: DollarSign,
    adminOnly: true,
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
    adminOnly: true,
  },
];
