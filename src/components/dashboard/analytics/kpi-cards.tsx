"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  Euro,
  ClipboardList,
  CalendarClock,
  FileWarning,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { formatEuro } from "@/lib/utils";
import { usePermission } from "@/components/auth/can-access";
import type { Permission } from "@/lib/permissions";
import type { DashboardAnalytics } from "@/lib/dashboard/analytics";

interface KpiItem {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  accent: string;
  iconBg: string;
  href: string;
  permission: Permission;
  actionLabel: string;
}

function KpiCardButton({ item, index }: { item: KpiItem; index: number }) {
  const router = useRouter();
  const allowed = usePermission(item.permission);

  function handleActivate() {
    if (!allowed) {
      toast.message("Diese Funktion ist noch nicht verfügbar.", {
        description: "Für diesen Bereich fehlt die Berechtigung.",
      });
      return;
    }
    router.push(item.href);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: "easeOut" }}
    >
      <button
        type="button"
        onClick={handleActivate}
        disabled={!allowed}
        aria-label={allowed ? item.actionLabel : `${item.label}: nicht verfügbar`}
        title={
          allowed
            ? item.actionLabel
            : "Diese Funktion ist noch nicht verfügbar."
        }
        className={`block h-full w-full rounded-xl text-left transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d5c63]/40 ${
          allowed
            ? "cursor-pointer"
            : "cursor-not-allowed opacity-60"
        }`}
      >
        <Card
          className={`group relative h-full !p-4 transition-all ${
            allowed
              ? "hover:border-[#0d5c63]/30 hover:shadow-md"
              : "hover:shadow-none"
          }`}
        >
          {allowed ? (
            <ArrowUpRight className="absolute right-3 top-3 h-4 w-4 text-slate-300 transition-colors group-hover:text-[#0d5c63]" />
          ) : (
            <span className="absolute right-3 top-3 text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Gesperrt
            </span>
          )}
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="min-w-0">
              <p className="truncate text-sm text-muted-foreground">{item.label}</p>
              <p className={`mt-1 text-2xl font-semibold ${item.accent}`}>
                {item.value}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {item.hint}
              </p>
              <p
                className={`mt-2 text-xs font-medium ${
                  allowed ? "text-[#0d5c63]" : "text-slate-400"
                }`}
              >
                {allowed ? `${item.actionLabel} →` : "Nicht verfügbar"}
              </p>
            </div>
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${item.iconBg}`}
            >
              <item.icon className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </button>
    </motion.div>
  );
}

export function KpiCards({ kpis }: { kpis: DashboardAnalytics["kpis"] }) {
  const items: KpiItem[] = [
    {
      label: "Umsatz diesen Monat",
      value: formatEuro(kpis.revenueThisMonth),
      hint: "Gestellte Rechnungen",
      icon: Euro,
      accent: "text-[#0d5c63]",
      iconBg: "bg-[#0d5c63]/10 text-[#0d5c63]",
      href: "/dashboard/umsatz",
      permission: "invoices.read",
      actionLabel: "Zur Umsatzübersicht",
    },
    {
      label: "Offene Aufträge",
      value: String(kpis.openOrders),
      hint: "In Bearbeitung",
      icon: ClipboardList,
      accent: "text-slate-900",
      iconBg: "bg-blue-50 text-blue-600",
      href: "/dashboard/auftraege?tab=aktiv",
      permission: "orders.read",
      actionLabel: "Zu den Aufträgen",
    },
    {
      label: "Termine heute",
      value: String(kpis.appointmentsToday),
      hint:
        kpis.overdueAppointments > 0
          ? `${kpis.overdueAppointments} überfällig`
          : "Geplante Einsätze",
      icon: CalendarClock,
      accent: kpis.overdueAppointments > 0 ? "text-red-600" : "text-slate-900",
      iconBg:
        kpis.overdueAppointments > 0
          ? "bg-red-50 text-red-600"
          : "bg-[#e87722]/10 text-[#e87722]",
      href: "/dashboard/disposition",
      permission: "appointments.read",
      actionLabel: "Zur Disposition",
    },
    {
      label: "Offene Rechnungen",
      value: String(kpis.openInvoicesCount),
      hint: formatEuro(kpis.openInvoicesSum),
      icon: FileWarning,
      accent: "text-slate-900",
      iconBg: "bg-amber-50 text-amber-600",
      href: "/dashboard/rechnungen",
      permission: "invoices.read",
      actionLabel: "Zu den Rechnungen",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => (
        <KpiCardButton key={item.label} item={item} index={index} />
      ))}
    </div>
  );
}
