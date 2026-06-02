"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  Euro,
  ClipboardList,
  CalendarClock,
  FileWarning,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatEuro } from "@/lib/utils";
import type { DashboardAnalytics } from "@/lib/dashboard/analytics";

interface KpiItem {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  accent: string;
  iconBg: string;
  href?: string;
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
      href: "/dashboard/kalkulation",
    },
    {
      label: "Offene Aufträge",
      value: String(kpis.openOrders),
      hint: "In Bearbeitung",
      icon: ClipboardList,
      accent: "text-slate-900",
      iconBg: "bg-blue-50 text-blue-600",
      href: "/dashboard/auftraege?tab=aktiv",
    },
    {
      label: "Termine heute",
      value: String(kpis.appointmentsToday),
      hint: "Geplante Einsätze",
      icon: CalendarClock,
      accent: "text-slate-900",
      iconBg: "bg-[#e87722]/10 text-[#e87722]",
      href: "/dashboard/disposition",
    },
    {
      label: "Offene Rechnungen",
      value: String(kpis.openInvoicesCount),
      hint: formatEuro(kpis.openInvoicesSum),
      icon: FileWarning,
      accent: "text-slate-900",
      iconBg: "bg-amber-50 text-amber-600",
      href: "/dashboard/kalkulation",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => {
        const inner = (
          <Card className="group relative h-full p-4 transition-all hover:border-[#0d5c63]/30 hover:shadow-md">
            {item.href && (
              <ArrowUpRight className="absolute right-3 top-3 h-4 w-4 text-slate-300 transition-colors group-hover:text-[#0d5c63]" />
            )}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-muted-foreground">
                  {item.label}
                </p>
                <p className={`mt-1 text-2xl font-semibold ${item.accent}`}>
                  {item.value}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {item.hint}
                </p>
              </div>
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${item.iconBg}`}
              >
                <item.icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        );

        return (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.06, ease: "easeOut" }}
          >
            {item.href ? (
              <Link href={item.href} className="block h-full">
                {inner}
              </Link>
            ) : (
              inner
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
