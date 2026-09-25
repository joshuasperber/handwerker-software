import { prisma } from "@/lib/prisma";
import { getOrCreateFinanceSettings } from "./settings";
import type { PlannedInvestmentDTO, InvestmentReserveProposalDTO } from "./types";
import { toInvestmentDTO, type InvestmentRecord } from "./investment-dto";
import {
  CALCULATION_BASIS_LABELS,
  COMPLETED_ORDER_STATUSES,
  RESERVE_ACTIVE_STATUSES,
  buildPaceInsights,
  highRevenueHint,
  monthLabel,
  monthRange,
  percentSumWarning,
  previousMonth,
  reservePressureWarning,
  suggestReserve,
  type OrderReserveSnapshot,
  type SavingsRule,
} from "./investment-reserve";

type ReserveRow = {
  investmentId: string;
  year: number;
  month: number;
  suggestedAmount: number;
  appliedAmount: number | null;
  status: "CONFIRMED" | "ADJUSTED" | "DEFERRED" | "IGNORED";
  explanation: string | null;
  orderCount: number;
};

function ruleOf(inv: InvestmentRecord): SavingsRule {
  return {
    savingsModel: inv.savingsModel ?? "TARGET_SCHEDULE",
    plannedAmount: inv.plannedAmount,
    savedAmount: inv.savedAmount ?? 0,
    plannedDate: inv.plannedDate,
    percentOfRevenue: inv.percentOfRevenue ?? null,
    amountPerOrder: inv.amountPerOrder ?? null,
    monthlyAmount: inv.monthlyAmount ?? null,
    calculationBasis: inv.calculationBasis ?? "NET",
  };
}

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export async function loadCompletedOrders(
  tenantId: string,
  year: number,
  month: number
): Promise<OrderReserveSnapshot[]> {
  const { from, to } = monthRange(year, month);
  const orders = await prisma.order.findMany({
    where: {
      tenantId,
      status: { in: [...COMPLETED_ORDER_STATUSES] },
      OR: [
        { completedAt: { gte: from, lte: to } },
        { completedAt: null, updatedAt: { gte: from, lte: to } },
      ],
    },
    select: {
      id: true,
      useFixedPrice: true,
      fixedPriceNet: true,
      calculations: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          netSalesPrice: true,
          grossSalesPrice: true,
          contributionMargin: true,
          useFixedPrice: true,
          fixedPriceNet: true,
        },
      },
    },
  });

  return orders.map((order) => {
    const calc = order.calculations[0];
    const fixed =
      order.useFixedPrice && order.fixedPriceNet != null
        ? order.fixedPriceNet
        : calc?.useFixedPrice && calc.fixedPriceNet != null
          ? calc.fixedPriceNet
          : null;
    const net = fixed ?? calc?.netSalesPrice ?? null;
    const gross = calc?.grossSalesPrice ?? null;
    return {
      id: order.id,
      net,
      gross,
      contribution: calc ? calc.contributionMargin : null,
    };
  });
}

async function loadDecisions(tenantId: string, year: number, month: number): Promise<ReserveRow[]> {
  return prisma.investmentReserveMonth.findMany({
    where: { tenantId, year, month },
  });
}

export async function loadReserveContext(tenantId: string, year: number, month: number) {
  const { from, to } = monthRange(year, month);
  const prior = shiftMonth(year, month, -1);
  const previous = monthRange(prior.year, prior.month);
  const [current, prev, expenses, settings] = await Promise.all([
    prisma.calculationDocument.aggregate({
      where: {
        documentType: "INVOICE",
        status: { not: "STORNIERT" },
        issueDate: { gte: from, lte: to },
        calculation: { tenantId },
      },
      _sum: { netAmount: true },
    }),
    prisma.calculationDocument.aggregate({
      where: {
        documentType: "INVOICE",
        status: { not: "STORNIERT" },
        issueDate: { gte: previous.from, lte: previous.to },
        calculation: { tenantId },
      },
      _sum: { netAmount: true },
    }),
    prisma.expense.aggregate({
      where: { tenantId, expenseDate: { gte: from, lte: to } },
      _sum: { netAmount: true },
    }),
    getOrCreateFinanceSettings(tenantId),
  ]);
  const revenueNet = current._sum.netAmount ?? 0;
  const previousRevenueNet = prev._sum.netAmount ?? 0;
  const estimatedProfit = revenueNet - (expenses._sum.netAmount ?? 0);
  const taxReserve = Math.max(0, estimatedProfit * (settings.estimatedTaxRate / 100));
  return { revenueNet, previousRevenueNet, estimatedProfit, taxReserve };
}

export async function enrichInvestments(
  tenantId: string,
  investments: InvestmentRecord[],
  now = new Date()
): Promise<PlannedInvestmentDTO[]> {
  const proposal = previousMonth(now);
  const prior = shiftMonth(proposal.year, proposal.month, -1);
  const [orders, decisions, priorDecisions] = await Promise.all([
    loadCompletedOrders(tenantId, proposal.year, proposal.month),
    loadDecisions(tenantId, proposal.year, proposal.month),
    loadDecisions(tenantId, prior.year, prior.month),
  ]);
  const label = monthLabel(proposal.year, proposal.month);

  return investments.map((inv) => {
    const decided = decisions.find((d) => d.investmentId === inv.id);
    const carry =
      priorDecisions.find((d) => d.investmentId === inv.id && d.status === "DEFERRED")
        ?.suggestedAmount ?? 0;
    const active = (RESERVE_ACTIVE_STATUSES as readonly string[]).includes(inv.status);
    const suggestion = active
      ? suggestReserve(ruleOf(inv), proposal, orders, carry)
      : null;
    const hints = buildPaceInsights({
      title: inv.title,
      plannedAmount: inv.plannedAmount,
      savedAmount: inv.savedAmount ?? 0,
      plannedDate: inv.plannedDate,
      startDate: inv.startDate ?? inv.createdAt,
      proposal,
      currentMonthly: inv.monthlyAmount ?? suggestion?.amount ?? 0,
      model: inv.savingsModel ?? "TARGET_SCHEDULE",
    });
    return toInvestmentDTO(inv, {
      monthSuggestion: decided ? decided.suggestedAmount : suggestion?.amount ?? null,
      monthSuggestionLabel: label,
      suggestionExplanation: decided?.explanation ?? suggestion?.explanation ?? null,
      hints,
    });
  });
}

export async function buildReserveProposal(
  tenantId: string,
  year: number,
  month: number,
  investments: InvestmentRecord[],
  context?: {
    revenueNet: number;
    previousRevenueNet: number;
    estimatedProfit: number;
    taxReserve: number;
  }
): Promise<InvestmentReserveProposalDTO> {
  const prior = shiftMonth(year, month, -1);
  const [orders, decisions, priorDecisions] = await Promise.all([
    loadCompletedOrders(tenantId, year, month),
    loadDecisions(tenantId, year, month),
    loadDecisions(tenantId, prior.year, prior.month),
  ]);

  const lines = investments
    .filter((inv) => (RESERVE_ACTIVE_STATUSES as readonly string[]).includes(inv.status))
    .map((inv) => {
      const decided = decisions.find((d) => d.investmentId === inv.id);
      const carry =
        priorDecisions.find((d) => d.investmentId === inv.id && d.status === "DEFERRED")
          ?.suggestedAmount ?? 0;
      const suggestion = suggestReserve(ruleOf(inv), { year, month }, orders, decided ? 0 : carry);
      const usesOrders =
        inv.savingsModel === "PERCENT_REVENUE" || inv.savingsModel === "FIXED_PER_ORDER";
      return {
        investmentId: inv.id,
        title: inv.title,
        suggestedAmount: decided ? decided.suggestedAmount : suggestion.amount,
        explanation: decided?.explanation ?? suggestion.explanation,
        calculationBasisLabel: usesOrders
          ? CALCULATION_BASIS_LABELS[inv.calculationBasis ?? "NET"]
          : null,
        orderCount: decided?.orderCount ?? suggestion.orderCount,
        status: decided?.status ?? ("OPEN" as const),
        appliedAmount: decided?.appliedAmount ?? null,
      };
    });

  const open = lines.filter((l) => l.status === "OPEN");
  const totalSuggested = open.reduce((s, l) => s + l.suggestedAmount, 0);
  const percentTotal = investments
    .filter(
      (inv) =>
        inv.savingsModel === "PERCENT_REVENUE" &&
        (RESERVE_ACTIVE_STATUSES as readonly string[]).includes(inv.status)
    )
    .reduce((s, inv) => s + (inv.percentOfRevenue ?? 0), 0);

  return {
    year,
    month,
    label: monthLabel(year, month),
    lines,
    totalSuggested: Math.round(totalSuggested * 100) / 100,
    openCount: open.length,
    warning: context
      ? reservePressureWarning({
          totalSuggested,
          revenueNet: context.revenueNet,
          estimatedProfit: context.estimatedProfit,
          taxReserve: context.taxReserve,
        })
      : null,
    percentWarning: percentSumWarning(percentTotal),
    revenueHint: context ? highRevenueHint(context.revenueNet, context.previousRevenueNet) : null,
    virtualOnly: true,
  };
}
