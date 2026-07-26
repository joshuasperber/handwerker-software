import { prisma } from "@/lib/prisma";
import { subMonths, startOfMonth, endOfMonth } from "date-fns";
import { toDocumentListItem } from "@/lib/documents/document-view";
import { getOrCreateFinanceSettings } from "./settings";
import { resolveFinancePeriod } from "./period";
import { buildFinanceWarnings } from "./warnings";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_PAYMENT_STATUS_LABELS,
  INVESTMENT_CATEGORY_LABELS,
  INVESTMENT_STATUS_LABELS,
  type ExpenseDTO,
  type FinanceOverview,
  type FinancePeriodPreset,
  type PlannedInvestmentDTO,
} from "./types";
import type { ExpenseCategory } from "@/generated/prisma/client";

const INVOICE_INCLUDE = {
  calculation: { include: { customer: true } },
  payments: true,
} as const;

function toExpenseDTO(expense: {
  id: string;
  category: ExpenseCategory;
  description: string;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  expenseDate: Date;
  paymentStatus: "OFFEN" | "BEZAHLT";
  supplier: string | null;
  orderId: string | null;
  customerId: string | null;
  internalNote: string | null;
  receiptFileName: string | null;
  receiptStorageKey: string | null;
  isInvestment: boolean;
  createdAt: Date;
}): ExpenseDTO {
  return {
    id: expense.id,
    category: expense.category,
    categoryLabel: EXPENSE_CATEGORY_LABELS[expense.category],
    description: expense.description,
    netAmount: expense.netAmount,
    vatAmount: expense.vatAmount,
    grossAmount: expense.grossAmount,
    expenseDate: expense.expenseDate.toISOString(),
    paymentStatus: expense.paymentStatus,
    paymentStatusLabel: EXPENSE_PAYMENT_STATUS_LABELS[expense.paymentStatus],
    supplier: expense.supplier,
    orderId: expense.orderId,
    customerId: expense.customerId,
    internalNote: expense.internalNote,
    hasReceipt: !!expense.receiptStorageKey,
    receiptFileName: expense.receiptFileName,
    isInvestment: expense.isInvestment,
    createdAt: expense.createdAt.toISOString(),
  };
}

interface RevenueResult {
  net: number;
  gross: number;
  invoiceCount: number;
}

function computeRevenueFromInvoices(
  invoices: Array<{
    status: string;
    netAmount: number;
    grossAmount: number;
    paidAmount: number;
    issueDate: Date;
    payments: Array<{ amount: number; paidAt: Date }>;
  }>,
  period: { from: Date; to: Date },
  revenueBasis: "ISSUE_DATE" | "PAYMENT_DATE",
  includeUnpaid: boolean
): RevenueResult {
  let net = 0;
  let gross = 0;
  let invoiceCount = 0;

  for (const inv of invoices) {
    if (inv.status === "STORNIERT") continue;

    if (revenueBasis === "ISSUE_DATE") {
      if (inv.issueDate < period.from || inv.issueDate > period.to) continue;

      if (!includeUnpaid && inv.status !== "BEZAHLT") {
        if (inv.status === "TEILBEZAHLT") {
          const ratio = inv.grossAmount > 0 ? inv.paidAmount / inv.grossAmount : 0;
          net += inv.netAmount * ratio;
          gross += inv.paidAmount;
          invoiceCount++;
        }
        continue;
      }

      net += inv.netAmount;
      gross += inv.grossAmount;
      invoiceCount++;
      continue;
    }

    // PAYMENT_DATE: sum payments in period
    let paymentNet = 0;
    let paymentGross = 0;
    for (const p of inv.payments) {
      if (p.paidAt < period.from || p.paidAt > period.to) continue;
      paymentGross += p.amount;
      const ratio = inv.grossAmount > 0 ? p.amount / inv.grossAmount : 0;
      paymentNet += inv.netAmount * ratio;
    }

    if (includeUnpaid && inv.status !== "BEZAHLT" && paymentGross === 0) {
      if (inv.issueDate >= period.from && inv.issueDate <= period.to) {
        net += inv.netAmount;
        gross += inv.grossAmount;
        invoiceCount++;
      }
      continue;
    }

    if (paymentGross > 0) {
      net += paymentNet;
      gross += paymentGross;
      invoiceCount++;
    }
  }

  return { net, gross, invoiceCount };
}

export async function getFinanceOverview(
  tenantId: string,
  options: {
    preset?: FinancePeriodPreset;
    from?: string | null;
    to?: string | null;
  } = {}
): Promise<FinanceOverview> {
  const now = new Date();
  const preset = options.preset ?? "current_month";
  const period = resolveFinancePeriod(preset, options.from, options.to, now);
  const settings = await getOrCreateFinanceSettings(tenantId);

  const [
    allInvoices,
    openInvoiceDocs,
    expenses,
    plannedInvestments,
    prevMonthInvoices,
    ordersWithMaterial,
  ] = await Promise.all([
    prisma.calculationDocument.findMany({
      where: {
        documentType: "INVOICE",
        calculation: { tenantId },
      },
      include: INVOICE_INCLUDE,
    }),
    prisma.calculationDocument.findMany({
      where: {
        documentType: "INVOICE",
        status: { in: ["OFFEN", "TEILBEZAHLT"] },
        calculation: { tenantId },
      },
      include: INVOICE_INCLUDE,
    }),
    prisma.expense.findMany({
      where: {
        tenantId,
        expenseDate: { gte: period.from, lte: period.to },
      },
      orderBy: { expenseDate: "desc" },
    }),
    prisma.plannedInvestment.findMany({
      where: { tenantId, status: { in: ["PLANNED", "POSTPONED"] } },
      orderBy: { plannedDate: "asc" },
    }),
    prisma.calculationDocument.findMany({
      where: {
        documentType: "INVOICE",
        status: { not: "STORNIERT" },
        issueDate: {
          gte: startOfMonth(subMonths(now, 1)),
          lte: endOfMonth(subMonths(now, 1)),
        },
        calculation: { tenantId },
      },
      select: { netAmount: true, grossAmount: true, status: true, paidAmount: true },
    }),
    prisma.order.findMany({
      where: {
        tenantId,
        materialLines: { some: {} },
        createdAt: { gte: period.from, lte: period.to },
      },
      select: { id: true },
    }),
  ]);

  // Optional: Katalog-Feld orderTypeLabel. Bei veraltetem Prisma-Client / fehlender Migration Fallback.
  let montageOrders: { id: string }[] = [];
  try {
    montageOrders = await prisma.order.findMany({
      where: {
        tenantId,
        OR: [
          { vehicleId: { not: null } },
          { orderType: "MONTAGE" },
          { orderTypeLabel: { contains: "Montage", mode: "insensitive" } },
        ],
        createdAt: { gte: period.from, lte: period.to },
      },
      select: { id: true },
    });
  } catch (err) {
    console.warn(
      "[finance] Montage-Filter ohne orderTypeLabel — bitte prisma generate / Dev-Server neu starten:",
      err instanceof Error ? err.message : err
    );
    montageOrders = await prisma.order.findMany({
      where: {
        tenantId,
        OR: [{ vehicleId: { not: null } }, { orderType: "MONTAGE" }],
        createdAt: { gte: period.from, lte: period.to },
      },
      select: { id: true },
    });
  }

  const revenue = computeRevenueFromInvoices(
    allInvoices,
    period,
    settings.revenueBasis,
    settings.includeUnpaidInvoices
  );

  const expenseNet = expenses.reduce((s, e) => s + e.netAmount, 0);
  const expenseGross = expenses.reduce((s, e) => s + e.grossAmount, 0);
  const withReceipt = expenses.filter((e) => e.receiptStorageKey).length;
  const withoutReceipt = expenses.length - withReceipt;

  const categoryMap = new Map<
    ExpenseCategory,
    { amount: number; count: number; withReceipt: number; withoutReceipt: number }
  >();
  for (const e of expenses) {
    const cur = categoryMap.get(e.category) ?? {
      amount: 0,
      count: 0,
      withReceipt: 0,
      withoutReceipt: 0,
    };
    cur.amount += e.netAmount;
    cur.count++;
    if (e.receiptStorageKey) cur.withReceipt++;
    else cur.withoutReceipt++;
    categoryMap.set(e.category, cur);
  }

  const byCategory = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      label: EXPENSE_CATEGORY_LABELS[category],
      amount: data.amount,
      count: data.count,
      withReceipt: data.withReceipt,
      withoutReceipt: data.withoutReceipt,
    }))
    .sort((a, b) => b.amount - a.amount);

  const estimatedNetProfit = revenue.net - expenseNet;
  const estimatedTax = Math.max(0, estimatedNetProfit * (settings.estimatedTaxRate / 100));

  const openItems = openInvoiceDocs.map((doc) => toDocumentListItem(doc, now));
  const overdueItems = openItems.filter((i) => i.overdue);
  const paidInvoices = allInvoices.filter((i) => i.status === "BEZAHLT");
  const canceledInvoices = allInvoices.filter((i) => i.status === "STORNIERT");
  const openInvoiceSum = openItems.reduce((s, i) => s + i.openAmount, 0);

  const prevMonthExpenseSum =
    (
      await prisma.expense.aggregate({
        where: {
          tenantId,
          expenseDate: {
            gte: startOfMonth(subMonths(now, 1)),
            lte: endOfMonth(subMonths(now, 1)),
          },
        },
        _sum: { netAmount: true },
      })
    )._sum.netAmount ?? 0;

  const prevMonthProfit =
    prevMonthInvoices.reduce((s, i) => s + i.netAmount, 0) - prevMonthExpenseSum;

  // Optional: Inventar-Verkäufe/Weitergaben. Fehlt die Inventar-Migration, darf die Übersicht nicht crashen.
  let inventorySales: { quantity: number; salePriceNet: number | null }[] = [];
  try {
    inventorySales = await prisma.stockMovement.findMany({
      where: {
        tenantId,
        reason: { in: ["VERKAUF", "WEITERGABE"] },
        occurredAt: { gte: period.from, lte: period.to },
      },
      select: { quantity: true, salePriceNet: true },
    });
  } catch (err) {
    console.warn(
      "[finance] Inventar-Verkäufe übersprungen — bitte Inventar-Migration ausführen / Dev-Server neu starten:",
      err instanceof Error ? err.message : err
    );
    inventorySales = [];
  }
  const documentedSaleNet = inventorySales.reduce((s, m) => {
    if (m.salePriceNet == null) return s;
    return s + m.salePriceNet * m.quantity;
  }, 0);

  const investmentDtos: PlannedInvestmentDTO[] = plannedInvestments.map((inv) => ({
    id: inv.id,
    title: inv.title,
    plannedAmount: inv.plannedAmount,
    plannedDate: inv.plannedDate?.toISOString() ?? null,
    category: inv.category,
    categoryLabel: INVESTMENT_CATEGORY_LABELS[inv.category],
    note: inv.note,
    status: inv.status,
    statusLabel: INVESTMENT_STATUS_LABELS[inv.status],
    createdAt: inv.createdAt.toISOString(),
  }));

  const targetNet = settings.monthlyProfitTargetNet;
  const targetDelta =
    targetNet != null && Number.isFinite(targetNet) ? estimatedNetProfit - targetNet : null;

  const warnings = buildFinanceWarnings({
    revenueNet: revenue.net,
    expenseNet,
    expenseCount: expenses.length,
    expensesWithoutReceipt: withoutReceipt,
    estimatedProfit: estimatedNetProfit,
    prevMonthProfit,
    openInvoiceSum,
    hasMaterialOrders: ordersWithMaterial.length > 0,
    materialExpenseCount: expenses.filter((e) => e.category === "MATERIAL").length,
    hasMontageOrders: montageOrders.length > 0,
    fuelExpenseCount: expenses.filter((e) => e.category === "FUEL").length,
    investmentExpenses: expenses.filter((e) => e.isInvestment).length,
    plannedInvestmentsCount: plannedInvestments.length,
    inventorySaleCount: inventorySales.length,
    thresholds: {
      highRevenueThreshold: settings.highRevenueThreshold,
      lowExpenseRatioThreshold: settings.lowExpenseRatioThreshold,
      profitSpikeFactor: settings.profitSpikeFactor,
      highProfitWarningThreshold: settings.highProfitWarningThreshold,
      monthlyProfitTargetNet: settings.monthlyProfitTargetNet,
      lowLiquidityWarningThreshold: settings.lowLiquidityWarningThreshold,
    },
  });

  return {
    period: {
      preset: period.preset,
      from: period.from.toISOString(),
      to: period.to.toISOString(),
      label: period.label,
    },
    settings,
    revenue: {
      net: revenue.net,
      gross: revenue.gross,
      invoiceCount: revenue.invoiceCount,
      basis: settings.revenueBasis,
      includesUnpaid: settings.includeUnpaidInvoices,
    },
    expenses: {
      net: expenseNet,
      gross: expenseGross,
      count: expenses.length,
      withReceipt,
      withoutReceipt,
      byCategory,
    },
    profit: {
      estimatedNet: estimatedNetProfit,
      isEstimate: true,
      targetNet,
      targetDelta,
    },
    tax: {
      estimatedRate: settings.estimatedTaxRate,
      estimatedAmount: estimatedTax,
      isEstimate: true,
    },
    invoices: {
      openCount: openItems.length,
      openSum: openInvoiceSum,
      overdueCount: overdueItems.length,
      overdueSum: overdueItems.reduce((s, i) => s + i.openAmount, 0),
      paidCount: paidInvoices.length,
      paidSum: paidInvoices.reduce((s, i) => s + i.grossAmount, 0),
      canceledCount: canceledInvoices.length,
    },
    inventorySales: {
      count: inventorySales.length,
      documentedSaleNet,
    },
    warnings,
    recentExpenses: expenses.slice(0, 10).map(toExpenseDTO),
    plannedInvestments: investmentDtos,
  };
}

export { toExpenseDTO };
