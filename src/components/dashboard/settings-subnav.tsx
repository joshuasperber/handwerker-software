"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/components/auth/can-access";
import { isNavItemActive } from "@/lib/dashboard-nav";
import { DASHBOARD_NAV_CONFIG, hasPermission } from "@/lib/permissions";
import { SETTINGS_PAGE_INTROS } from "@/lib/settings-nav";
import { cn } from "@/lib/utils";

export function SettingsSubnav() {
  const pathname = usePathname();
  const session = useSession();
  const items = DASHBOARD_NAV_CONFIG.filter((item) => {
    if (item.section !== "einstellungen") return false;
    if (item.permission === null) return true;
    return hasPermission(session.role, item.permission, {
      canManageRoles: session.canManageRoles,
    });
  });

  if (items.length === 0) return null;

  return (
    <nav
      className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-slate-200 pb-px"
      aria-label="Einstellungen"
    >
      {items.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={SETTINGS_PAGE_INTROS[item.href]?.description}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-[#0d5c63] text-[#0d5c63]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
