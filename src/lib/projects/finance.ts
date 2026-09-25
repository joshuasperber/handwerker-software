import { prisma } from "@/lib/prisma";
import { calcLaborCost, calcWorkedHours } from "@/lib/time-entry";

export interface CostBuckets {
  material: number;
  labor: number;
  machines: number;
  travel: number;
  other: number;
}

export interface FinanceInvoice {
  id: string;
  documentNumber: string;
  status: string;
  net: number;
  gross: number;
  paid: number;
  orderId: string | null;
  calculationId: string;
  isClosing: boolean;
}

export interface FinanceOrderInput {
  id: string;
  orderNumber: string;
  title: string | null;
  /** Einkaufswert der Materialpositionen. */
  materialPurchase: number;
  laborHours: number;
  laborCost: number;
  laborMissingWage: boolean;
  /** Geplante Kosten aus der Kalkulation. */
  planned: CostBuckets;
  /** Geplanter Kundennetto (Festpreis oder Kalkulation). */
  plannedRevenue: number;
  /** Geplanter Gewinn aus der Kalkulation. */
  plannedProfit: number;
}

export interface ProjectFinanceInput {
  orders: FinanceOrderInput[];
  expenses: {
    id: string;
    category: string;
    net: number;
    hasReceipt: boolean;
    orderId: string | null;
  }[];
  projectCosts: {
    net: number;
    source: string;
    expenseId: string | null;
    orderId: string | null;
    invoicedCalculationId: string | null;
  }[];
  invoices: FinanceInvoice[];
}

export interface ProjectFinanceResult {
  revenueNet: number;
  revenueGross: number;
  openInvoiceGross: number;
  paidInvoiceGross: number;
  unbilledNet: number;
  costs: CostBuckets;
  costTotal: number;
  profit: number;
  marginPercent: number | null;
  planned: CostBuckets;
  plannedProfit: number;
  plannedMarginPercent: number | null;
  variance: CostBuckets & { profit: number };
  orders: {
    id: string;
    orderNumber: string;
    title: string | null;
    revenueNet: number;
    costTotal: number;
    profit: number;
    inClosingInvoice: boolean;
  }[];
  laborLines: {
    orderNumber: string;
    hours: number;
    cost: number | null;
    missingWage: boolean;
  }[];
  closingInvoiceNumbers: string[];
  orderInvoiceNumbers: string[];
  excludedOrderInvoiceNumbers: string[];
  doubleBillingWarning: string | null;
  incomplete: string[];
  missingReceipts: number;
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

const ZERO: CostBuckets = { material: 0, labor: 0, machines: 0, travel: 0, other: 0 };

function sum(b: CostBuckets) {
  return round(b.material + b.labor + b.machines + b.travel + b.other);
}

function expenseKey(category: string): keyof CostBuckets {
  if (category === "MATERIAL") return "material";
  if (category === "MACHINERY" || category === "TOOLS") return "machines";
  if (category === "FUEL" || category === "VEHICLES") return "travel";
  return "other";
}

export function buildProjectFinance(input: ProjectFinanceInput): ProjectFinanceResult {
  const closing = input.invoices.filter((i) => i.isClosing);
  const closingCalcIds = new Set(closing.map((i) => i.calculationId));
  const covered = new Set(
    input.projectCosts
      .filter((c) => c.orderId && c.invoicedCalculationId && closingCalcIds.has(c.invoicedCalculationId))
      .map((c) => c.orderId as string)
  );
  const closingWithoutLinks = closing.length > 0 && covered.size === 0;

  const counted: FinanceInvoice[] = [];
  const excluded: FinanceInvoice[] = [];
  for (const invoice of input.invoices) {
    if (invoice.isClosing) {
      counted.push(invoice);
      continue;
    }
    const hidden =
      closing.length > 0 &&
      invoice.orderId != null &&
      (covered.has(invoice.orderId) || closingWithoutLinks);
    if (hidden) excluded.push(invoice);
    else counted.push(invoice);
  }

  const revenueNet = round(counted.reduce((s, i) => s + i.net, 0));
  const revenueGross = round(counted.reduce((s, i) => s + i.gross, 0));
  const openInvoiceGross = round(
    counted
      .filter((i) => i.status === "OFFEN" || i.status === "TEILBEZAHLT" || i.status === "ENTWURF")
      .reduce((s, i) => s + Math.max(0, i.gross - i.paid), 0)
  );
  const paidInvoiceGross = round(
    counted.reduce((s, i) => {
      if (i.status === "BEZAHLT") return s + i.gross;
      return s + Math.min(i.gross, Math.max(0, i.paid));
    }, 0)
  );

  const expenseIds = new Set(input.expenses.map((e) => e.id));
  const costs: CostBuckets = { ...ZERO };
  for (const expense of input.expenses) costs[expenseKey(expense.category)] += expense.net;
  for (const cost of input.projectCosts) {
    if (cost.expenseId && (expenseIds.has(cost.expenseId) || cost.source === "EXPENSE")) continue;
    if (cost.source === "INVENTORY" || cost.source === "ORDER_MATERIAL") costs.material += cost.net;
    else if (cost.source !== "INVOICE") costs.other += cost.net;
  }

  const materialFromEvidence =
    input.expenses.some((e) => e.category === "MATERIAL") ||
    input.projectCosts.some((c) => c.source === "INVENTORY" || c.source === "ORDER_MATERIAL");
  const machinesFromExpense = input.expenses.some(
    (e) => e.category === "MACHINERY" || e.category === "TOOLS"
  );
  const travelFromExpense = input.expenses.some(
    (e) => e.category === "FUEL" || e.category === "VEHICLES"
  );

  const planned: CostBuckets = { ...ZERO };
  let plannedProfit = 0;
  let plannedRevenue = 0;
  const laborLines: ProjectFinanceResult["laborLines"] = [];
  let laborMissing = false;

  for (const order of input.orders) {
    planned.material += order.planned.material;
    planned.labor += order.planned.labor;
    planned.machines += order.planned.machines;
    planned.travel += order.planned.travel;
    planned.other += order.planned.other;
    plannedProfit += order.plannedProfit;
    plannedRevenue += order.plannedRevenue;
    costs.labor += order.laborCost;
    if (!materialFromEvidence) costs.material += order.materialPurchase;
    if (!machinesFromExpense) costs.machines += order.planned.machines;
    if (!travelFromExpense) costs.travel += order.planned.travel;
    if (order.laborMissingWage) laborMissing = true;
    if (order.laborHours > 0) {
      laborLines.push({
        orderNumber: order.orderNumber,
        hours: order.laborHours,
        cost: order.laborMissingWage ? null : order.laborCost,
        missingWage: order.laborMissingWage,
      });
    }
  }

  (Object.keys(costs) as (keyof CostBuckets)[]).forEach((key) => {
    costs[key] = round(costs[key]);
    planned[key] = round(planned[key]);
  });

  const countedIds = new Set(counted.map((i) => i.id));
  const orders = input.orders.map((order) => {
    const revenueNet = round(
      input.invoices
        .filter((i) => i.orderId === order.id && countedIds.has(i.id))
        .reduce((s, i) => s + i.net, 0)
    );
    const costTotal = round(
      order.laborCost +
        (materialFromEvidence ? 0 : order.materialPurchase) +
        (machinesFromExpense ? 0 : order.planned.machines) +
        (travelFromExpense ? 0 : order.planned.travel) +
        order.planned.other
    );
    const inClosing =
      covered.has(order.id) ||
      (closingWithoutLinks && input.invoices.some((i) => i.orderId === order.id));
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      title: order.title,
      revenueNet,
      costTotal,
      profit: round(revenueNet - costTotal),
      inClosingInvoice: inClosing,
    };
  });

  const billedOrderIds = new Set(
    input.invoices.filter((i) => i.orderId).map((i) => i.orderId as string)
  );
  const unbilledNet = round(
    input.orders
      .filter((o) => !billedOrderIds.has(o.id) && !covered.has(o.id))
      .reduce((s, o) => s + o.plannedRevenue, 0)
  );

  const costTotal = sum(costs);
  const profit = round(revenueNet - costTotal);
  const incomplete: string[] = [];
  if (laborMissing) {
    incomplete.push(
      "Bei mindestens einem Stundenzettel fehlt der interne Stundenlohn. Diese Stunden stehen in der Liste, fließen aber nicht in die Kosten."
    );
  }
  if (!materialFromEvidence && costs.material > 0) {
    incomplete.push("Material ist der Einkaufswert der Auftragspositionen. Ein Beleg ist nicht zugeordnet.");
  }
  if (!machinesFromExpense && costs.machines > 0) {
    incomplete.push("Maschinenkosten stammen aus der Kalkulation, nicht aus einem Beleg.");
  }
  if (!travelFromExpense && costs.travel > 0) {
    incomplete.push("Fahrtkosten stammen aus der Kalkulation, nicht aus einem Beleg.");
  }
  if (input.expenses.some((e) => !e.hasReceipt)) {
    incomplete.push("Mindestens eine Projektausgabe hat keinen Beleg.");
  }
  if (revenueNet === 0 && unbilledNet > 0) {
    incomplete.push("Es gibt noch nicht abgerechnete Aufträge. Der Umsatz enthält sie nicht.");
  }

  return {
    revenueNet,
    revenueGross,
    openInvoiceGross,
    paidInvoiceGross,
    unbilledNet,
    costs,
    costTotal,
    profit,
    marginPercent: revenueNet > 0 ? round((profit / revenueNet) * 100) : null,
    planned,
    plannedProfit: round(plannedProfit),
    plannedMarginPercent: plannedRevenue > 0 ? round((plannedProfit / plannedRevenue) * 100) : null,
    variance: {
      material: round(costs.material - planned.material),
      labor: round(costs.labor - planned.labor),
      machines: round(costs.machines - planned.machines),
      travel: round(costs.travel - planned.travel),
      other: round(costs.other - planned.other),
      profit: round(profit - plannedProfit),
    },
    orders,
    laborLines,
    closingInvoiceNumbers: closing.map((i) => i.documentNumber),
    orderInvoiceNumbers: input.invoices.filter((i) => !i.isClosing).map((i) => i.documentNumber),
    excludedOrderInvoiceNumbers: excluded.map((i) => i.documentNumber),
    doubleBillingWarning:
      excluded.length > 0
        ? `Diese Einzelrechnungen werden nicht zusätzlich zur Abschlussrechnung gezählt: ${excluded
            .map((i) => i.documentNumber)
            .join(", ")}.`
        : null,
    incomplete,
    missingReceipts: input.expenses.filter((e) => !e.hasReceipt).length,
  };
}

export async function getProjectFinance(tenantId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId },
    select: { id: true, name: true, status: true },
  });
  if (!project) return null;

  const [orders, expenses, projectCosts, closingCalcs] = await Promise.all([
    prisma.order.findMany({
      where: { tenantId, projectId },
      select: {
        id: true,
        orderNumber: true,
        title: true,
        materialLines: {
          select: {
            quantityRequired: true,
            unitPriceNet: true,
            isTool: true,
            article: { select: { purchasePriceNet: true } },
          },
        },
        timeEntries: {
          select: {
            startTime: true,
            endTime: true,
            breakMinutes: true,
            employee: { select: { hourlyWageNet: true } },
          },
        },
        calculations: {
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: {
            id: true,
            orderId: true,
            projectId: true,
            materialTotal: true,
            laborTotal: true,
            machineTotal: true,
            travelTotal: true,
            additionalTotal: true,
            profitAmount: true,
            netSalesPrice: true,
            useFixedPrice: true,
            fixedPriceNet: true,
            documents: {
              where: { documentType: "INVOICE", status: { not: "STORNIERT" }, cancelOfId: null },
              select: {
                id: true,
                documentNumber: true,
                status: true,
                netAmount: true,
                grossAmount: true,
                paidAmount: true,
                calculationId: true,
              },
            },
          },
        },
      },
    }),
    prisma.expense.findMany({
      where: { tenantId, projectId },
      select: {
        id: true,
        category: true,
        netAmount: true,
        receiptStorageKey: true,
        orderId: true,
      },
    }),
    prisma.projectCost.findMany({
      where: { projectId },
      select: {
        netAmount: true,
        source: true,
        expenseId: true,
        orderId: true,
        invoicedCalculationId: true,
      },
    }),
    prisma.calculation.findMany({
      where: { tenantId, projectId, orderId: null },
      select: {
        id: true,
        documents: {
          where: { documentType: "INVOICE", status: { not: "STORNIERT" }, cancelOfId: null },
          select: {
            id: true,
            documentNumber: true,
            status: true,
            netAmount: true,
            grossAmount: true,
            paidAmount: true,
            calculationId: true,
          },
        },
      },
    }),
  ]);

  const invoices: FinanceInvoice[] = [];
  const financeOrders: FinanceOrderInput[] = orders.map((order) => {
    let hours = 0;
    let laborCost = 0;
    let missing = false;
    for (const entry of order.timeEntries) {
      const worked = calcWorkedHours(entry.startTime, entry.endTime, entry.breakMinutes);
      if (worked == null || worked <= 0) continue;
      hours += worked;
      const cost = calcLaborCost(worked, entry.employee.hourlyWageNet);
      if (cost == null) missing = true;
      else laborCost += cost;
    }
    const calc = order.calculations[0];
    const customerNet =
      calc?.useFixedPrice && calc.fixedPriceNet != null ? calc.fixedPriceNet : (calc?.netSalesPrice ?? 0);
    for (const doc of calc?.documents ?? []) {
      invoices.push({
        id: doc.id,
        documentNumber: doc.documentNumber,
        status: doc.status,
        net: doc.netAmount,
        gross: doc.grossAmount,
        paid: doc.paidAmount,
        orderId: order.id,
        calculationId: doc.calculationId,
        isClosing: false,
      });
    }
    const materialPurchase = order.materialLines
      .filter((l) => !l.isTool)
      .reduce(
        (s, l) => s + (l.unitPriceNet ?? l.article?.purchasePriceNet ?? 0) * l.quantityRequired,
        0
      );
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      title: order.title,
      materialPurchase: round(materialPurchase),
      laborHours: round(hours),
      laborCost: round(laborCost),
      laborMissingWage: missing,
      planned: {
        material: calc?.materialTotal ?? 0,
        labor: calc?.laborTotal ?? 0,
        machines: calc?.machineTotal ?? 0,
        travel: calc?.travelTotal ?? 0,
        other: calc?.additionalTotal ?? 0,
      },
      plannedRevenue: customerNet,
      plannedProfit: calc?.profitAmount ?? 0,
    };
  });

  for (const calc of closingCalcs) {
    for (const doc of calc.documents) {
      invoices.push({
        id: doc.id,
        documentNumber: doc.documentNumber,
        status: doc.status,
        net: doc.netAmount,
        gross: doc.grossAmount,
        paid: doc.paidAmount,
        orderId: null,
        calculationId: doc.calculationId,
        isClosing: true,
      });
    }
  }

  return {
    project,
    ...buildProjectFinance({
      orders: financeOrders,
      expenses: expenses.map((e) => ({
        id: e.id,
        category: e.category,
        net: e.netAmount,
        hasReceipt: Boolean(e.receiptStorageKey),
        orderId: e.orderId,
      })),
      projectCosts: projectCosts.map((c) => ({
        net: c.netAmount,
        source: c.source,
        expenseId: c.expenseId,
        orderId: c.orderId,
        invoicedCalculationId: c.invoicedCalculationId,
      })),
      invoices,
    }),
  };
}
