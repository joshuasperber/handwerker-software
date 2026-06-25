import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@/generated/prisma/client";
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
  DONE_ORDER_STATUSES,
} from "@/lib/utils";
import { buildAppointmentOverdueWhere, TERMINAL_APPOINTMENT_STATUSES } from "@/lib/scheduling/overdue";
import { toDocumentListItem } from "@/lib/documents/document-view";

const INVOICE_DOC_INCLUDE = {
  calculation: { include: { customer: true } },
} as const;

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
    overdueAppointments: number;
    openInvoicesCount: number;
    openInvoicesSum: number;
  };
  revenuePerMonth: RevenuePoint[];
  ordersByStatus: ChartPoint[];
  invoiceStatus: Array<ChartPoint & { status: string }>;
  appointmentsPerWeek: ChartPoint[];
  upcomingAppointments: UpcomingAppointmentDTO[];
  overdueAppointments: UpcomingAppointmentDTO[];
  recentOrders: RecentOrderDTO[];
  overdueInvoices: OverdueInvoiceDTO[];
  /** True when invoice KPIs use legacy calculation fields (e.g. DB schema not yet migrated). */
  invoiceMetricsApproximate?: boolean;
}

interface InvoiceRevenueDoc {
  issueDate: Date;
  amount: number;
}

interface InvoiceAnalyticsSlice {
  revenueDocs: InvoiceRevenueDoc[];
  openInvoicesCount: number;
  openInvoicesSum: number;
  overdueInvoices: OverdueInvoiceDTO[];
  approximate: boolean;
}

async function loadInvoiceAnalytics(
  tenantId: string,
  rangeMonthsStart: Date,
  now: Date
): Promise<InvoiceAnalyticsSlice> {
  try {
    const [invoiceDocsForRevenue, openInvoiceDocs] = await Promise.all([
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
        include: INVOICE_DOC_INCLUDE,
      }),
    ]);

    const openItems = openInvoiceDocs.map((doc) => toDocumentListItem(doc, now));
    const overdueItems = openItems
      .filter((item) => item.overdue)
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
      .slice(0, 6);

    return {
      revenueDocs: invoiceDocsForRevenue.map((doc) => ({
        issueDate: doc.issueDate,
        amount: doc.grossAmount ?? 0,
      })),
      openInvoicesCount: openItems.length,
      openInvoicesSum: openItems.reduce((sum, item) => sum + item.openAmount, 0),
      overdueInvoices: overdueItems.map((item) => ({
        id: item.id,
        documentNumber: item.documentNumber,
        dueDate: item.dueDate!,
        amount: item.openAmount,
        customer: item.customerName,
      })),
      approximate: false,
    };
  } catch (error) {
    console.warn(
      "[dashboard] document-based invoice analytics failed, using legacy fallback:",
      error
    );
  }

  try {
    const [invoiceDocsForRevenue, legacyOpenDocs] = await Promise.all([
    prisma.calculationDocument.findMany({
      where: {
        documentType: "INVOICE",
        issueDate: { gte: rangeMonthsStart },
        calculation: { tenantId },
      },
      select: {
        issueDate: true,
        calculation: { select: { grossSalesPrice: true } },
      },
    }),
    prisma.calculationDocument.findMany({
      where: {
        documentType: "INVOICE",
        calculation: { tenantId, status: "INVOICE_CREATED" },
      },
      include: INVOICE_DOC_INCLUDE,
    }),
  ]);

  const legacyItems = legacyOpenDocs.map((doc) => toDocumentListItem(doc, now));
  const overdueItems = legacyItems
    .filter((item) => item.overdue)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, 6);

  return {
    revenueDocs: invoiceDocsForRevenue.map((doc) => ({
      issueDate: doc.issueDate,
      amount: doc.calculation?.grossSalesPrice ?? 0,
    })),
    openInvoicesCount: legacyItems.length,
    openInvoicesSum: legacyItems.reduce((sum, item) => sum + item.openAmount, 0),
    overdueInvoices: overdueItems.map((item) => ({
      id: item.id,
      documentNumber: item.documentNumber,
      dueDate: item.dueDate!,
      amount: item.openAmount,
      customer: item.customerName,
    })),
    approximate: true,
  };
  } catch (legacyError) {
    console.error("[dashboard] legacy invoice analytics failed:", legacyError);
    return {
      revenueDocs: [],
      openInvoicesCount: 0,
      openInvoicesSum: 0,
      overdueInvoices: [],
      approximate: true,
    };
  }
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
    invoiceAnalytics,
    invoiceStatusGroups,
    openOrdersCount,
    ordersStatusGroups,
    appointmentsToday,
    overdueAppointmentsCount,
    appointmentsForWeeks,
    overdueAppointments,
    upcomingAppointments,
    recentOrders,
  ] = await Promise.all([
    loadInvoiceAnalytics(tenantId, rangeMonthsStart, now),
    prisma.calculation.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: { _all: true },
    }),
    prisma.order.count({
      where: {
        tenantId,
        status: { notIn: DONE_ORDER_STATUSES as OrderStatus[] },
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
        status: { notIn: TERMINAL_APPOINTMENT_STATUSES },
      },
    }),
    prisma.appointment.count({
      where: buildAppointmentOverdueWhere(tenantId, now),
    }),
    prisma.appointment.findMany({
      where: {
        tenantId,
        startTime: { gte: rangeWeeksStart },
        status: { notIn: ["STORNIERT"] },
      },
      select: { startTime: true },
    }),
    prisma.appointment.findMany({
      where: buildAppointmentOverdueWhere(tenantId, now),
      include: {
        order: { include: { customer: true, property: true } },
        employee: { include: { user: true } },
      },
      orderBy: { startTime: "asc" },
      take: 6,
    }),
    prisma.appointment.findMany({
      where: {
        tenantId,
        startTime: { gte: now },
        status: { notIn: ["STORNIERT"] },
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
  ]);

  const monthBuckets = buildMonthBuckets(now);
  let revenueThisMonth = 0;
  for (const doc of invoiceAnalytics.revenueDocs) {
    const amount = doc.amount;
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
      overdueAppointments: overdueAppointmentsCount,
      openInvoicesCount: invoiceAnalytics.openInvoicesCount,
      openInvoicesSum: invoiceAnalytics.openInvoicesSum,
    },
    invoiceMetricsApproximate: invoiceAnalytics.approximate,
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
    upcomingAppointments: upcomingAppointments.map(mapAppointmentToDTO),
    overdueAppointments: overdueAppointments.map(mapAppointmentToDTO),
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
    overdueInvoices: invoiceAnalytics.overdueInvoices,
  };
}

type AppointmentWithRelations = {
  id: string;
  startTime: Date;
  order: {
    id: string;
    orderNumber: string;
    customer: { firstName: string; lastName: string };
    property: { city: string | null } | null;
  } | null;
  employee: {
    user: { firstName: string; lastName: string };
  } | null;
};

function mapAppointmentToDTO(appt: AppointmentWithRelations): UpcomingAppointmentDTO {
  return {
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
