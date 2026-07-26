import { prisma } from "@/lib/prisma";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { de } from "date-fns/locale";
import { ORDER_STATUS_LABELS } from "@/lib/utils";
import { getOrCreateFinanceSettings } from "@/lib/finance/settings";
import {
  isSingleMonthPeriod,
  resolveFinancePeriod,
} from "@/lib/finance/period";
import type { FinancePeriodPreset } from "@/lib/finance/types";
import type {
  RevenueMonthHistoryRow,
  RevenueOrderRow,
  RevenueOverview,
} from "./types";

const MONTHS_HISTORY = 6;

const INVOICE_STATUS_LABELS: Record<string, string> = {
  ENTWURF: "Entwurf",
  OFFEN: "Offen",
  TEILBEZAHLT: "Teilbezahlt",
  BEZAHLT: "Bezahlt",
  STORNIERT: "Storniert",
  GEMISCHT: "Gemischt",
  KEINE: "Keine Rechnung",
};

const INVOICE_INCLUDE = {
  calculation: {
    include: {
      customer: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          title: true,
          status: true,
          createdAt: true,
        },
      },
    },
  },
  payments: true,
} as const;

type InvoiceRow = {
  id: string;
  status: string;
  issueDate: Date;
  dueDate: Date | null;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  paidAmount: number;
  payments: Array<{ amount: number; paidAt: Date }>;
  calculation: {
    title: string | null;
    customer: { firstName: string; lastName: string } | null;
    order: {
      id: string;
      orderNumber: string;
      title: string | null;
      status: string;
      createdAt: Date;
    } | null;
  };
};

function customerName(
  customer: { firstName: string; lastName: string } | null | undefined
): string {
  if (!customer) return "—";
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || "—";
}

function invoiceInPeriod(
  inv: InvoiceRow,
  period: { from: Date; to: Date },
  revenueBasis: "ISSUE_DATE" | "PAYMENT_DATE"
): boolean {
  if (revenueBasis === "ISSUE_DATE") {
    return inv.issueDate >= period.from && inv.issueDate <= period.to;
  }
  return inv.payments.some((p) => p.paidAt >= period.from && p.paidAt <= period.to);
}

/** Anteil einer Rechnung, der im Zeitraum nach Zahlungsbasis zählt. */
function paymentShareInPeriod(
  inv: InvoiceRow,
  period: { from: Date; to: Date }
): { net: number; vat: number; gross: number; paid: number } {
  let paid = 0;
  for (const p of inv.payments) {
    if (p.paidAt < period.from || p.paidAt > period.to) continue;
    paid += p.amount;
  }
  const ratio = inv.grossAmount > 0 ? paid / inv.grossAmount : 0;
  return {
    net: inv.netAmount * ratio,
    vat: inv.vatAmount * ratio,
    gross: paid,
    paid,
  };
}

function aggregateInvoiceStatus(statuses: string[]): string {
  const unique = [...new Set(statuses.filter((s) => s !== "STORNIERT"))];
  if (unique.length === 0 && statuses.includes("STORNIERT")) return "STORNIERT";
  if (unique.length === 0) return "KEINE";
  if (unique.length === 1) return unique[0]!;
  if (unique.every((s) => s === "BEZAHLT")) return "BEZAHLT";
  if (unique.some((s) => s === "OFFEN" || s === "TEILBEZAHLT")) {
    if (unique.some((s) => s === "BEZAHLT" || s === "TEILBEZAHLT")) return "TEILBEZAHLT";
    return "OFFEN";
  }
  return "GEMISCHT";
}

export async function getRevenueOverview(
  tenantId: string,
  options: {
    preset?: FinancePeriodPreset;
    from?: string | null;
    to?: string | null;
  } = {}
): Promise<RevenueOverview> {
  const now = new Date();
  const preset = options.preset ?? "current_month";
  const period = resolveFinancePeriod(preset, options.from, options.to, now);
  const settings = await getOrCreateFinanceSettings(tenantId);
  const historyFrom = startOfMonth(subMonths(now, MONTHS_HISTORY - 1));

  const [allInvoicesRaw, recentOrders] = await Promise.all([
    prisma.calculationDocument.findMany({
      where: {
        documentType: "INVOICE",
        calculation: { tenantId },
      },
      include: INVOICE_INCLUDE,
    }),
    prisma.order.findMany({
      where: {
        tenantId,
        createdAt: { gte: historyFrom },
        status: { not: "STORNIERT" },
      },
      select: { id: true, createdAt: true },
    }),
  ]);
  const allInvoices = allInvoicesRaw as InvoiceRow[];

  const ordersCreatedInMonth = new Map<string, Set<string>>();
  for (const order of recentOrders) {
    const key = monthKey(order.createdAt);
    const set = ordersCreatedInMonth.get(key) ?? new Set<string>();
    set.add(order.id);
    ordersCreatedInMonth.set(key, set);
  }

  let totalNet = 0;
  let totalGross = 0;
  let totalVat = 0;
  let invoiceCount = 0;

  let openCount = 0;
  let openSumNet = 0;
  let openSumGross = 0;
  let paidCount = 0;
  let paidSumNet = 0;
  let paidSumGross = 0;
  let overdueCount = 0;
  let overdueSumNet = 0;
  let overdueSumGross = 0;
  let canceledCount = 0;
  let canceledSumNet = 0;
  let canceledSumGross = 0;

  /** Rechnungen, die zur Auftragsliste gehören (inkl. storniert separat aggregiert). */
  const listInvoices: InvoiceRow[] = [];

  for (const inv of allInvoices) {
    const inPeriod = invoiceInPeriod(inv, period, settings.revenueBasis);

    if (inv.status === "STORNIERT") {
      if (inv.issueDate >= period.from && inv.issueDate <= period.to) {
        canceledCount++;
        canceledSumNet += inv.netAmount;
        canceledSumGross += inv.grossAmount;
        listInvoices.push(inv);
      }
      continue;
    }

    if (!inPeriod) continue;
    listInvoices.push(inv);

    // Umsatz (ohne Storno)
    if (settings.revenueBasis === "ISSUE_DATE") {
      if (!settings.includeUnpaidInvoices && inv.status !== "BEZAHLT") {
        if (inv.status === "TEILBEZAHLT") {
          const ratio = inv.grossAmount > 0 ? inv.paidAmount / inv.grossAmount : 0;
          totalNet += inv.netAmount * ratio;
          totalVat += inv.vatAmount * ratio;
          totalGross += inv.paidAmount;
          invoiceCount++;
        }
      } else {
        totalNet += inv.netAmount;
        totalVat += inv.vatAmount;
        totalGross += inv.grossAmount;
        invoiceCount++;
      }
    } else {
      const share = paymentShareInPeriod(inv, period);
      if (share.gross > 0) {
        totalNet += share.net;
        totalVat += share.vat;
        totalGross += share.gross;
        invoiceCount++;
      } else if (
        settings.includeUnpaidInvoices &&
        inv.status !== "BEZAHLT" &&
        inv.issueDate >= period.from &&
        inv.issueDate <= period.to
      ) {
        totalNet += inv.netAmount;
        totalVat += inv.vatAmount;
        totalGross += inv.grossAmount;
        invoiceCount++;
      }
    }

    // Status-Kennzahlen im Zeitraum (nach Ausstellungsdatum für Offen/Überfällig/Bezahlt)
    const issuedInPeriod =
      inv.issueDate >= period.from && inv.issueDate <= period.to;

    if (issuedInPeriod) {
      if (inv.status === "BEZAHLT") {
        paidCount++;
        paidSumNet += inv.netAmount;
        paidSumGross += inv.grossAmount;
      } else if (inv.status === "OFFEN" || inv.status === "TEILBEZAHLT") {
        const openGross = Math.max(0, inv.grossAmount - inv.paidAmount);
        const openRatio = inv.grossAmount > 0 ? openGross / inv.grossAmount : 0;
        const openNet = inv.netAmount * openRatio;
        openCount++;
        openSumNet += openNet;
        openSumGross += openGross;
        if (inv.dueDate && inv.dueDate.getTime() < now.getTime()) {
          overdueCount++;
          overdueSumNet += openNet;
          overdueSumGross += openGross;
        }
      }
    }
  }

  // Auftragsliste: nach Auftrag gruppieren
  const groups = new Map<
    string,
    {
      orderId: string | null;
      orderNumber: string | null;
      title: string;
      customerName: string;
      date: Date;
      orderStatus: string | null;
      invoices: InvoiceRow[];
    }
  >();

  for (const inv of listInvoices) {
    const order = inv.calculation.order;
    const key = order?.id ?? `invoice:${inv.id}`;
    const existing = groups.get(key);
    if (existing) {
      existing.invoices.push(inv);
      if (inv.issueDate > existing.date) existing.date = inv.issueDate;
      continue;
    }
    groups.set(key, {
      orderId: order?.id ?? null,
      orderNumber: order?.orderNumber ?? null,
      title:
        order?.title?.trim() ||
        inv.calculation.title?.trim() ||
        (order ? `Auftrag ${order.orderNumber}` : `Rechnung`),
      customerName: customerName(inv.calculation.customer),
      date: inv.issueDate,
      orderStatus: order?.status ?? null,
      invoices: [inv],
    });
  }

  const orders: RevenueOrderRow[] = Array.from(groups.values())
    .map((g) => {
      const active = g.invoices.filter((i) => i.status !== "STORNIERT");
      const forAmounts = active.length > 0 ? active : g.invoices;
      const netAmount = forAmounts.reduce((s, i) => s + i.netAmount, 0);
      const vatAmount = forAmounts.reduce((s, i) => s + i.vatAmount, 0);
      const grossAmount = forAmounts.reduce((s, i) => s + i.grossAmount, 0);
      const paidAmount = forAmounts.reduce((s, i) => s + i.paidAmount, 0);
      const openAmount = Math.max(0, grossAmount - paidAmount);
      const invoiceStatus = aggregateInvoiceStatus(g.invoices.map((i) => i.status));
      const primaryInvoice =
        active.find((i) => i.status === "OFFEN" || i.status === "TEILBEZAHLT") ??
        active[0] ??
        g.invoices[0] ??
        null;

      return {
        orderId: g.orderId,
        orderNumber: g.orderNumber,
        title: g.title,
        customerName: g.customerName,
        date: g.date.toISOString(),
        orderStatus: g.orderStatus,
        orderStatusLabel: g.orderStatus
          ? (ORDER_STATUS_LABELS[g.orderStatus] ?? g.orderStatus)
          : null,
        invoiceStatus,
        invoiceStatusLabel: INVOICE_STATUS_LABELS[invoiceStatus] ?? invoiceStatus,
        netAmount,
        vatAmount,
        grossAmount,
        paidAmount,
        openAmount,
        invoiceCount: g.invoices.length,
        primaryInvoiceId: primaryInvoice?.id ?? null,
        href: g.orderId
          ? `/dashboard/auftraege/${g.orderId}`
          : primaryInvoice
            ? `/dashboard/rechnungen`
            : "/dashboard/rechnungen",
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const monthHistory = buildMonthHistory(
    allInvoices,
    ordersCreatedInMonth,
    now,
    settings.revenueBasis,
    settings.includeUnpaidInvoices
  );

  return {
    period: {
      preset: period.preset,
      from: period.from.toISOString(),
      to: period.to.toISOString(),
      label: period.label,
      isSingleMonth: isSingleMonthPeriod(period.from, period.to),
    },
    settings: {
      revenueBasis: settings.revenueBasis,
      includeUnpaidInvoices: settings.includeUnpaidInvoices,
    },
    totals: {
      net: round2(totalNet),
      gross: round2(totalGross),
      vat: round2(totalVat),
      invoiceCount,
    },
    invoices: {
      openCount,
      openSumNet: round2(openSumNet),
      openSumGross: round2(openSumGross),
      paidCount,
      paidSumNet: round2(paidSumNet),
      paidSumGross: round2(paidSumGross),
      overdueCount,
      overdueSumNet: round2(overdueSumNet),
      overdueSumGross: round2(overdueSumGross),
      canceledCount,
      canceledSumNet: round2(canceledSumNet),
      canceledSumGross: round2(canceledSumGross),
    },
    orders,
    monthHistory,
  };
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthHistory(
  invoices: InvoiceRow[],
  ordersCreatedInMonth: Map<string, Set<string>>,
  now: Date,
  revenueBasis: "ISSUE_DATE" | "PAYMENT_DATE",
  includeUnpaid: boolean
): RevenueMonthHistoryRow[] {
  const rows: RevenueMonthHistoryRow[] = [];

  for (let i = 0; i < MONTHS_HISTORY; i++) {
    const ref = startOfMonth(subMonths(now, i));
    const from = startOfMonth(ref);
    const to = endOfMonth(ref);
    const key = monthKey(ref);

    let revenueNet = 0;
    let revenueGross = 0;
    let vat = 0;
    let invoiceCount = 0;
    let paidNet = 0;
    let paidGross = 0;
    let openNet = 0;
    let openGross = 0;
    const orderIds = new Set<string>(ordersCreatedInMonth.get(key) ?? []);

    for (const inv of invoices) {
      if (inv.status === "STORNIERT") continue;
      if (!invoiceInPeriod(inv, { from, to }, revenueBasis)) continue;

      invoiceCount++;
      if (inv.calculation.order?.id) orderIds.add(inv.calculation.order.id);

      if (revenueBasis === "ISSUE_DATE") {
        if (!includeUnpaid && inv.status !== "BEZAHLT") {
          if (inv.status === "TEILBEZAHLT") {
            const ratio = inv.grossAmount > 0 ? inv.paidAmount / inv.grossAmount : 0;
            revenueNet += inv.netAmount * ratio;
            vat += inv.vatAmount * ratio;
            revenueGross += inv.paidAmount;
          }
        } else {
          revenueNet += inv.netAmount;
          vat += inv.vatAmount;
          revenueGross += inv.grossAmount;
        }
      } else {
        const share = paymentShareInPeriod(inv, { from, to });
        if (share.gross > 0) {
          revenueNet += share.net;
          vat += share.vat;
          revenueGross += share.gross;
        } else if (
          includeUnpaid &&
          inv.status !== "BEZAHLT" &&
          inv.issueDate >= from &&
          inv.issueDate <= to
        ) {
          revenueNet += inv.netAmount;
          vat += inv.vatAmount;
          revenueGross += inv.grossAmount;
        }
      }

      if (inv.issueDate >= from && inv.issueDate <= to) {
        if (inv.status === "BEZAHLT") {
          paidNet += inv.netAmount;
          paidGross += inv.grossAmount;
        } else if (inv.status === "OFFEN" || inv.status === "TEILBEZAHLT") {
          const og = Math.max(0, inv.grossAmount - inv.paidAmount);
          const ratio = inv.grossAmount > 0 ? og / inv.grossAmount : 0;
          openNet += inv.netAmount * ratio;
          openGross += og;
          paidNet += inv.netAmount * (1 - ratio);
          paidGross += inv.paidAmount;
        }
      }
    }

    rows.push({
      key,
      label: format(ref, "MMMM yyyy", { locale: de }),
      year: ref.getFullYear(),
      monthIndex: ref.getMonth(),
      from: from.toISOString(),
      to: to.toISOString(),
      revenueNet: round2(revenueNet),
      revenueGross: round2(revenueGross),
      vat: round2(vat),
      invoiceCount,
      orderCount: orderIds.size,
      paidNet: round2(paidNet),
      paidGross: round2(paidGross),
      openNet: round2(openNet),
      openGross: round2(openGross),
    });
  }

  return rows;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
