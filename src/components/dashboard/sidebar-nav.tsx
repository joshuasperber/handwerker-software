"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  FolderKanban,
  Calendar,
  Users,
  UserCircle,
  Wrench,
  MessageSquare,
  Sparkles,
  Calculator,
  Package,
  ShoppingCart,
  Truck,
  Cog,
  TrendingUp,
  Receipt,
  Clock,
  ClipboardPen,
  Settings,
  User,
  Bell,
  Euro,
  ChevronDown,
  Building2,
  Shield,
  ShieldCheck,
  Activity,
  type LucideIcon,
} from "lucide-react";
import { DashboardNavLink } from "@/components/dashboard/nav-link";
import { navSectionContainsPath } from "@/lib/dashboard-nav";
import {
  NAV_SECTION_LABELS,
  type NavSection,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { swrKeys, useApiSWR } from "@/lib/swr";

const NAV_ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/dashboard/auftraege": ClipboardList,
  "/dashboard/projekte": FolderKanban,
  "/dashboard/termine": Calendar,
  "/dashboard/inventar": Package,
  "/dashboard/einkauf": ShoppingCart,
  "/dashboard/disposition": Truck,
  "/dashboard/stunden": Clock,
  "/dashboard/kalkulation": Calculator,
  "/dashboard/rechnungen": Receipt,
  "/dashboard/umsatz": Euro,
  "/dashboard/finanzuebersicht": TrendingUp,
  "/dashboard/stundenzettel": ClipboardPen,
  "/dashboard/einstellungen/betrieb": Building2,
  "/dashboard/einstellungen/rechnung": Settings,
  "/dashboard/einstellungen/benachrichtigungen": Bell,
  "/dashboard/einstellungen/rollen": ShieldCheck,
  "/dashboard/einstellungen/sicherheit": Shield,
  "/dashboard/einstellungen/system": Activity,
  "/dashboard/einstellungen/assistent": Sparkles,
  "/dashboard/profil": User,
  "/dashboard/kunden": Users,
  "/dashboard/mitarbeiter": UserCircle,
  "/dashboard/leistungen": Wrench,
  "/dashboard/maschinen": Cog,
  "/dashboard/nachrichten": MessageSquare,
  "/dashboard/ki-assistent": Sparkles,
};

type NavItem = { href: string; label: string; section?: NavSection };

const SECTION_ORDER: Exclude<NavSection, null>[] = [
  "betrieb",
  "material",
  "finanzen",
  "stammdaten",
  "einstellungen",
];

export function DashboardSidebarNav({
  items,
  onNavigate,
}: {
  items: NavItem[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { data: unread } = useApiSWR<{ count: number }>(
    swrKeys.messagesUnreadCount(),
    { refreshInterval: 60_000 }
  );
  const messagesBadge = unread?.count ?? 0;

  const { sections, ungrouped } = useMemo(() => {
    const bySection = new Map<Exclude<NavSection, null>, NavItem[]>();
    const rest: NavItem[] = [];
    for (const item of items) {
      const section = item.section ?? null;
      if (!section) {
        rest.push(item);
        continue;
      }
      const list = bySection.get(section) ?? [];
      list.push(item);
      bySection.set(section, list);
    }
    return {
      sections: SECTION_ORDER.filter((id) => (bySection.get(id)?.length ?? 0) > 0).map(
        (id) => ({ id, label: NAV_SECTION_LABELS[id], items: bySection.get(id)! })
      ),
      ungrouped: rest,
    };
  }, [items]);

  const [userOpen, setUserOpen] = useState<Record<string, boolean>>({});

  function isSectionOpen(id: string, sectionItems: NavItem[]) {
    if (Object.prototype.hasOwnProperty.call(userOpen, id)) return userOpen[id];
    return navSectionContainsPath(sectionItems, pathname);
  }

  function toggleSection(id: string, sectionItems: NavItem[]) {
    const currentlyOpen = isSectionOpen(id, sectionItems);
    setUserOpen((prev) => ({ ...prev, [id]: !currentlyOpen }));
  }

  function renderLink(item: NavItem) {
    const Icon = NAV_ICONS[item.href] ?? LayoutDashboard;
    return (
      <DashboardNavLink
        key={item.href}
        href={item.href}
        label={item.label}
        icon={Icon}
        onClick={onNavigate}
        badge={
          item.href === "/dashboard/nachrichten" ? messagesBadge : undefined
        }
      />
    );
  }

  return (
    <>
      {sections.map((section) => {
        const containsCurrent = navSectionContainsPath(section.items, pathname);
        const open = isSectionOpen(section.id, section.items);
        return (
          <div key={section.id} className="mb-1">
            <button
              type="button"
              onClick={() => toggleSection(section.id, section.items)}
              aria-expanded={open}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-slate-50",
                containsCurrent ? "bg-slate-50 text-slate-900" : "text-slate-500"
              )}
            >
              {section.label}
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  open ? "rotate-0" : "-rotate-90"
                )}
              />
            </button>
            {open && <div className="space-y-0.5">{section.items.map(renderLink)}</div>}
          </div>
        );
      })}
      {ungrouped.length > 0 && (
        <div className="mt-2 space-y-0.5 border-t border-slate-100 pt-2">
          {ungrouped.map(renderLink)}
        </div>
      )}
    </>
  );
}
