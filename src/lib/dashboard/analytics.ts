import { prisma } from "@/lib/prisma";
import {
  startOfDay,
  endOfDay,
  startOfMonth,
  subMonths,
  startOfWeek,
  subWeeks,
  format,
  getISOWeek,
} from "date-fns";
import { de } from "date-fns/locale";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_FLOW,
} from "@/lib/utils";

const MONTHS_BACK = 6;
const WEEKS_BACK = 8;

/** Status-Labels für Rechnungen (abgeleitet aus Calculation.status). */
export const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Entwurf",
  CALCULATED: "Kalkuliert",
  OFFER_CREATED: "Angebot",
  INVOICE_CREATED: "Rechnung offen",
  ARCHIVED: "Bezahlt / Archiviert",
};

export interface ChartPoint {
  label: string;
  value: number;
}

export interface RevenuePoint {
  label: string;
  umsatz: number;
}

export interface UpcomingAppointmentDTO {
  id: string;
  start: string;
  orderId: string | null;
  orderNumber: string | null;
  customer: string;
  city: string | null;
  employee: string | null;
}

export interface RecentOrderDTO {
  id: string;
  orderNumber: string;
  title: string | null;
  status: string;
  statusLabel: string;
  priority: string;
  customer: string;
  city: string | null;
  createdAt: string;
}

export interface OverdueInvoiceDTO {
  id: string;
  documentNumber: string;
  dueDate: string;
  amount: number;
  customer: string;
}

export interface DashboardAnalytics {
  kpis: {
    revenueThisMonth: number;
    openOrders: number;
    appointmentsToday: number;
    openInvoicesCount: number;
    openInvoicesSum: number;
  };
  revenuePerMonth: RevenuePoint[];
  ordersByStatus: ChartPoint[];
  invoiceStatus: Array<ChartPoint & { status: string }>;
  appointmentsPerWeek: ChartPoint[];
  upcomingAppointments: UpcomingAppointmentDTO[];
  recentOrders: RecentOrderDTO[];
  overdueInvoices: OverdueInvoiceDTO[];
}

export async function getDashboardAnalytics(
  tenantId: string
): Promise<DashboardAnalytics> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const rangeMonthsStart = startOfMonth(subMonths(now, MONTHS_BACK - 1));
  const rangeWeeksStart = startOfWeek(subWeeks(now, WEEKS_BACK - 1), {
    weekStartsOn: 1,
  });

  const [
    invoiceDocsForRevenue,
    openInvoiceDocs,
    invoiceStatusGroups,
    openOrdersCount,
    ordersStatusGroups,
    appointmentsToday,
    appointmentsForWeeks,
    upcomingAppointments,
    recentOrders,
    overdueInvoices,
  ] = await Promise.all([
    prisma.calculationDocument.findMany({
      where: {
        documentType: "INVOICE",
        issueDate: { gte: rangeMonthsStart },
        calculation: { tenantId },
      },
      select: {
        issueDate: true,
        grossAmount: true,
      },
    }),
    prisma.calculationDocument.findMany({
      where: {
        documentType: "INVOICE",
        status: { in: ["OFFEN", "TEILBEZAHLT"] },
        calculation: { tenantId },
      },
      select: { grossAmount: true, paidAmount: true },
    }),
    prisma.calculation.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: { _all: true },
    }),
    prisma.order.count({
      where: {
        tenantId,
        status: { notIn: ["ABGESCHLOSSEN", "ABGERECHNET", "STORNIERT"] },
      },
    }),
    prisma.order.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: { _all: true },
    }),
    prisma.appointment.count({
      where: {
        tenantId,
        startTime: { gte: startOfDay(now), lte: endOfDay(now) },
        status: { not: "STORNIERT" },
      },
    }),
    prisma.appointment.findMany({
      where: {
        tenantId,
        startTime: { gte: rangeWeeksStart },
        status: { not: "STORNIERT" },
      },
      select: { startTime: true },
    }),
    prisma.appointment.findMany({
      where: {
        tenantId,
        startTime: { gte: now },
        status: { not: "STORNIERT" },
      },
      include: {
        order: { include: { customer: true, property: true } },
        employee: { include: { user: true } },
      },
      orderBy: { startTime: "asc" },
      take: 6,
    }),
    prisma.order.findMany({
      where: { tenantId },
      include: { customer: true, property: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.calculationDocument.findMany({
      where: {
        documentType: "INVOICE",
        status: { in: ["OFFEN", "TEILBEZAHLT"] },
        dueDate: { lt: now },
        calculation: { tenantId },
      },
      include: { calculation: { include: { customer: true } } },
      orderBy: { dueDate: "asc" },
      take: 6,
    }),
  ]);

  const openInvoicesSum = openInvoiceDocs.reduce(
    (sum, d) => sum + Math.max(0, d.grossAmount - d.paidAmount),
    0
  );

  const monthBuckets = buildMonthBuckets(now);
  let revenueThisMonth = 0;
  for (const doc of invoiceDocsForRevenue) {
    const amount = doc.grossAmount ?? 0;
    const key = monthKey(doc.issueDate);
    const bucket = monthBuckets.find((m) => m.key === key);
    if (bucket) bucket.umsatz += amount;
    if (doc.issueDate >= monthStart) revenueThisMonth += amount;
  }

  const weekBuckets = buildWeekBuckets(now);
  for (const appt of appointmentsForWeeks) {
    const key = weekKey(appt.startTime);
    const bucket = weekBuckets.find((w) => w.key === key);
    if (bucket) bucket.value += 1;
  }

  const ordersStatusMap = new Map(
    ordersStatusGroups.map((g) => [g.status as string, g._count._all])
  );
  const ordersByStatus: ChartPoint[] = ORDER_STATUS_FLOW.filter(
    (status) => (ordersStatusMap.get(status) ?? 0) > 0
  ).map((status) => ({
    label: ORDER_STATUS_LABELS[status] ?? status,
    value: ordersStatusMap.get(status) ?? 0,
  }));

  const invoiceStatus = invoiceStatusGroups
    .map((g) => ({
      status: g.status as string,
      label: INVOICE_STATUS_LABELS[g.status as string] ?? (g.status as string),
      value: g._count._all,
    }))
    .filter((entry) => entry.value > 0);

  return {
    kpis: {
      revenueThisMonth,
      openOrders: openOrdersCount,
      appointmentsToday,
      openInvoicesCount: openInvoiceDocs.length,
      openInvoicesSum,
    },
    revenuePerMonth: monthBuckets.map(({ label, umsatz }) => ({
      label,
      umsatz: Math.round(umsatz),
    })),
    ordersByStatus,
    invoiceStatus,
    appointmentsPerWeek: weekBuckets.map(({ label, value }) => ({
      label,
      value,
    })),
    upcomingAppointments: upcomingAppointments.map((appt) => ({
      id: appt.id,
      start: appt.startTime.toISOString(),
      orderId: appt.order?.id ?? null,
      orderNumber: appt.order?.orderNumber ?? null,
      customer: appt.order
        ? `${appt.order.customer.firstName} ${appt.order.customer.lastName}`
        : "—",
      city: appt.order?.property?.city ?? null,
      employee: appt.employee?.user
        ? `${appt.employee.user.firstName} ${appt.employee.user.lastName}`
        : null,
    })),
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      title: order.title,
      status: order.status as string,
      statusLabel: ORDER_STATUS_LABELS[order.status as string] ?? order.status,
      priority: order.priority as string,
      customer: `${order.customer.firstName} ${order.customer.lastName}`,
      city: order.property?.city ?? null,
      createdAt: order.createdAt.toISOString(),
    })),
    overdueInvoices: overdueInvoices.map((doc) => ({
      id: doc.id,
      documentNumber: doc.documentNumber,
      dueDate: (doc.dueDate ?? doc.issueDate).toISOString(),
      amount: Math.max(0, doc.grossAmount - doc.paidAmount),
      customer: doc.calculation?.customer
        ? `${doc.calculation.customer.firstName} ${doc.calculation.customer.lastName}`
        : "—",
    })),
  };
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function buildMonthBuckets(now: Date) {
  const buckets: Array<{ key: string; label: string; umsatz: number }> = [];
  for (let i = MONTHS_BACK - 1; i >= 0; i--) {
    const date = startOfMonth(subMonths(now, i));
    buckets.push({
      key: monthKey(date),
      label: format(date, "LLL", { locale: de }),
      umsatz: 0,
    });
  }
  return buckets;
}

function weekKey(date: Date): string {
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  return `${monday.getFullYear()}-${getISOWeek(monday)}`;
}

function buildWeekBuckets(now: Date) {
  const buckets: Array<{ key: string; label: string; value: number }> = [];
  for (let i = WEEKS_BACK - 1; i >= 0; i--) {
    const date = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
    buckets.push({
      key: `${date.getFullYear()}-${getISOWeek(date)}`,
      label: `KW ${getISOWeek(date)}`,
      value: 0,
    });
  }
  return buckets;
}
