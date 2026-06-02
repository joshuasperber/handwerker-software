"use client";

import { motion } from "motion/react";
import { TrendingUp, BarChart3, PieChart, CalendarDays } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import type { DashboardAnalytics } from "@/lib/dashboard/analytics";
import { KpiCards } from "./kpi-cards";
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
  children,
}: {
  title: string;
  description: string;
  icon: typeof TrendingUp;
  delay: number;
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
          <CardTitle className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-[#0d5c63]" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </motion.div>
  );
}

export function DashboardView({ data }: { data: DashboardAnalytics }) {
  return (
    <div className="space-y-6">
      <KpiCards kpis={data.kpis} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Umsatz pro Monat"
          description="Gestellte Rechnungen der letzten 6 Monate"
          icon={TrendingUp}
          delay={0.05}
        >
          <RevenueChart data={data.revenuePerMonth} />
        </ChartCard>

        <ChartCard
          title="Aufträge nach Status"
          description="Verteilung aller Aufträge"
          icon={BarChart3}
          delay={0.1}
        >
          <OrdersStatusChart data={data.ordersByStatus} />
        </ChartCard>

        <ChartCard
          title="Rechnungsstatus"
          description="Status der Kalkulationen / Rechnungen"
          icon={PieChart}
          delay={0.15}
        >
          <InvoiceStatusChart data={data.invoiceStatus} />
        </ChartCard>

        <ChartCard
          title="Termine pro Woche"
          description="Termine der letzten 8 Wochen"
          icon={CalendarDays}
          delay={0.2}
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
        <UpcomingAppointmentsList items={data.upcomingAppointments} />
        <RecentOrdersList items={data.recentOrders} />
        <OverdueInvoicesList items={data.overdueInvoices} />
      </motion.div>
    </div>
  );
}
