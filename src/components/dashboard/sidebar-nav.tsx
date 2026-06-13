"use client";

import {
  LayoutDashboard,
  ClipboardList,
  Calendar,
  Users,
  UserCircle,
  Wrench,
  MessageSquare,
  Calculator,
  Package,
  ShoppingCart,
  Truck,
  Cog,
  Receipt,
  Clock,
  Settings,
  User,
  Bell,
  type LucideIcon,
} from "lucide-react";
import { DashboardNavLink } from "@/components/dashboard/nav-link";

const NAV_ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/dashboard/auftraege": ClipboardList,
  "/dashboard/termine": Calendar,
  "/dashboard/inventar": Package,
  "/dashboard/einkauf": ShoppingCart,
  "/dashboard/disposition": Truck,
  "/dashboard/kalkulation": Calculator,
  "/dashboard/rechnungen": Receipt,
  "/dashboard/stundenzettel": Clock,
  "/dashboard/einstellungen/rechnung": Settings,
  "/dashboard/einstellungen/benachrichtigungen": Bell,
  "/dashboard/profil": User,
  "/dashboard/kunden": Users,
  "/dashboard/mitarbeiter": UserCircle,
  "/dashboard/leistungen": Wrench,
  "/dashboard/maschinen": Cog,
  "/dashboard/nachrichten": MessageSquare,
};

export function DashboardSidebarNav({
  items,
  onNavigate,
}: {
  items: { href: string; label: string }[];
  onNavigate?: () => void;
}) {
  return (
    <>
      {items.map(({ href, label }) => {
        const Icon = NAV_ICONS[href] ?? LayoutDashboard;
        return (
          <DashboardNavLink
            key={href}
            href={href}
            label={label}
            icon={Icon}
            onClick={onNavigate}
          />
        );
      })}
    </>
  );
}
