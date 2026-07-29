"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { TrendingUp, BarChart3, PieChart, CalendarDays, ArrowUpRight } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import type { DashboardAnalytics } from "@/lib/dashboard/analytics";
import { usePermission } from "@/components/auth/can-access";
import { KpiCards, DashboardCalcShortcut } from "./kpi-cards";
import { RevenueChart } from "./revenue-chart";
import { OrdersStatusChart } from "./orders-status-chart";
import { InvoiceStatusChart } from "./invoice-status-chart";
import { AppointmentsWeekChart } from "./appointments-week-chart";
import {
  UpcomingAppointmentsList,
  RecentOrdersList,
  OverdueInvoicesList,
} from "./dashboard-lists";

function ChartCard({
  title,
  description,
  icon: Icon,
  delay,
  href,
  linkLabel,
  children,
}: {
  title: string;
  description: string;
  icon: typeof TrendingUp;
  delay: number;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-[#0d5c63]" />
              {title}
            </CardTitle>
            {href && linkLabel ? (
              <Link
                href={href}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#0d5c63] hover:underline"
              >
                {linkLabel}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </motion.div>
  );
}

export function DashboardView({ data }: { data: DashboardAnalytics }) {
  const canReadInvoices = usePermission("invoices.read");
  const canReadOrders = usePermission("orders.read");
  const canReadAppointments = usePermission("appointments.read");
  const canReadCalculations = usePermission("calculations.read");

  return (
    <div className="space-y-6">
      {data.invoiceMetricsApproximate && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Rechnungs-Kennzahlen werden vorläufig aus Kalkulationen abgeleitet. Für
          vollständige Offene-Posten-Auswertungen bitte die Produktions-Datenbank
          mit dem aktuellen Schema synchronisieren.
        </div>
      )}
      <KpiCards kpis={data.kpis} />
      <DashboardCalcShortcut />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Umsatz pro Monat"
          description="Gestellte Rechnungen der letzten 6 Monate"
          icon={TrendingUp}
          delay={0.05}
          href={canReadInvoices ? "/dashboard/umsatz" : undefined}
          linkLabel={canReadInvoices ? "Umsatzübersicht" : undefined}
        >
          <RevenueChart data={data.revenuePerMonth} />
        </ChartCard>

        <ChartCard
          title="Aufträge nach Status"
          description="Verteilung aller Aufträge"
          icon={BarChart3}
          delay={0.1}
          href={canReadOrders ? "/dashboard/auftraege" : undefined}
          linkLabel={canReadOrders ? "Aufträge" : undefined}
        >
          <OrdersStatusChart data={data.ordersByStatus} />
        </ChartCard>

        <ChartCard
          title="Rechnungsstatus"
          description="Status der Kalkulationen / Rechnungen"
          icon={PieChart}
          delay={0.15}
          href={
            canReadCalculations
              ? "/dashboard/kalkulation"
              : canReadInvoices
                ? "/dashboard/rechnungen"
                : undefined
          }
          linkLabel={
            canReadCalculations
              ? "Zur Kalkulation"
              : canReadInvoices
                ? "Rechnungen"
                : undefined
          }
        >
          <InvoiceStatusChart data={data.invoiceStatus} />
        </ChartCard>

        <ChartCard
          title="Termine pro Woche"
          description="Termine der letzten 8 Wochen"
          icon={CalendarDays}
          delay={0.2}
          href={canReadAppointments ? "/dashboard/termine" : undefined}
          linkLabel={canReadAppointments ? "Termine" : undefined}
        >
          <AppointmentsWeekChart data={data.appointmentsPerWeek} />
        </ChartCard>
      </div>

      <motion.div
        className="grid grid-cols-1 gap-4 lg:grid-cols-3"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25, ease: "easeOut" }}
      >
        <UpcomingAppointmentsList
          overdue={data.overdueAppointments}
          upcoming={data.upcomingAppointments}
        />
        <RecentOrdersList items={data.recentOrders} />
        <OverdueInvoicesList items={data.overdueInvoices} />
      </motion.div>
    </div>
  );
}
