import type { PlannedInvestmentDTO } from "./types";

export type FinanceAssistantState = "ON_TRACK" | "REVIEW" | "PLAN_FIRST";

export interface FinanceAssistantInvoice {
  status: string;
  netAmount: number;
  grossAmount: number;
  paidAmount: number;
  issueDate: Date;
  payments: Array<{ amount: number; paidAt: Date }>;
}

export interface FinanceAssistantProjection {
  currentRevenueNet: number;
  projectedRevenueNet: number;
  additionalReceivablesNet: number;
}

export interface FinanceAssistantInvestmentScenario {
  investmentId: string;
  title: string;
  categoryLabel: string;
  plannedAmount: number;
  plannedDate: string | null;
  readinessLabel: string;
  projectedProfitAfterImmediateDeduction: number;
  taxOrientationBefore: number;
  taxOrientationAfterImmediateDeduction: number;
  modeledTaxDifference: number;
  needsOperationalCheck: boolean;
}

export interface FinanceAssistantInsight {
  state: FinanceAssistantState;
  eyebrow: string;
  headline: string;
  summary: string;
  currentProfit: number;
  projectedProfit: number;
  projectedAdditionalRevenue: number;
  reviewThreshold: number;
  amountAboveThreshold: number;
  investmentScenario: FinanceAssistantInvestmentScenario | null;
  nextSteps: string[];
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function invoiceOutstandingNet(invoice: FinanceAssistantInvoice): number {
  if (invoice.status === "STORNIERT" || invoice.grossAmount <= 0) return 0;
  const openGross = Math.max(0, invoice.grossAmount - invoice.paidAmount);
  return invoice.netAmount * (openGross / invoice.grossAmount);
}

/**
 * Forecasts period revenue if every currently open invoice arrives by the period end.
 * The result follows the configured revenue basis and deliberately avoids pretending
 * that an issued invoice is already cash in the bank.
 */
export function buildReceivablesProjection(input: {
  invoices: FinanceAssistantInvoice[];
  period: { from: Date; to: Date };
  revenueBasis: "ISSUE_DATE" | "PAYMENT_DATE";
  currentRevenueNet: number;
}): FinanceAssistantProjection {
  const activeInvoices = input.invoices.filter((invoice) => invoice.status !== "STORNIERT");

  let projectedRevenueNet = 0;

  if (input.revenueBasis === "ISSUE_DATE") {
    projectedRevenueNet = activeInvoices.reduce((sum, invoice) => {
      if (invoice.issueDate < input.period.from || invoice.issueDate > input.period.to) return sum;
      return sum + invoice.netAmount;
    }, 0);
  } else {
    const receivedNet = activeInvoices.reduce((sum, invoice) => {
      if (invoice.grossAmount <= 0) return sum;
      const periodPayments = invoice.payments.reduce((paymentSum, payment) => {
        if (payment.paidAt < input.period.from || payment.paidAt > input.period.to) {
          return paymentSum;
        }
        return paymentSum + payment.amount;
      }, 0);
      return sum + invoice.netAmount * (periodPayments / invoice.grossAmount);
    }, 0);
    const openNet = activeInvoices.reduce(
      (sum, invoice) => sum + invoiceOutstandingNet(invoice),
      0
    );
    projectedRevenueNet = receivedNet + openNet;
  }

  // Existing revenue can contain explicitly included forecasts. Never make the
  // assistant projection look worse than the user's currently selected view.
  projectedRevenueNet = Math.max(input.currentRevenueNet, projectedRevenueNet);

  return {
    currentRevenueNet: roundMoney(input.currentRevenueNet),
    projectedRevenueNet: roundMoney(projectedRevenueNet),
    additionalReceivablesNet: roundMoney(
      Math.max(0, projectedRevenueNet - input.currentRevenueNet)
    ),
  };
}

function investmentPriority(investment: PlannedInvestmentDTO, targetAmount: number): number {
  const statusScore =
    investment.status === "GOAL_REACHED" ? 50 : investment.status === "ACTIVE" ? 35 : 20;
  const linkedNeedScore =
    investment.machineId || investment.articleId || investment.projectId ? 20 : 0;
  const fundingScore = Math.min(20, investment.progressPercent / 5);
  const amountDistance = Math.abs(investment.plannedAmount - targetAmount);
  const distanceScore = Math.max(0, 20 - amountDistance / Math.max(100, targetAmount || 1));
  const datedScore = investment.plannedDate ? 5 : 0;
  return statusScore + linkedNeedScore + fundingScore + distanceScore + datedScore;
}

function pickInvestment(
  investments: PlannedInvestmentDTO[],
  projectedProfit: number,
  amountAboveThreshold: number
): PlannedInvestmentDTO | null {
  const candidates = investments.filter(
    (investment) =>
      ["PLANNED", "ACTIVE", "GOAL_REACHED"].includes(investment.status) &&
      investment.plannedAmount > 0 &&
      investment.plannedAmount <= Math.max(0, projectedProfit)
  );
  if (candidates.length === 0) return null;

  return [...candidates].sort(
    (a, b) =>
      investmentPriority(b, amountAboveThreshold) -
      investmentPriority(a, amountAboveThreshold)
  )[0];
}

/**
 * Builds a decision aid, not a tax assessment. The investment scenario intentionally
 * models the strongest simple case (full immediate deduction) and labels it as such.
 */
export function buildFinanceAssistantInsight(input: {
  currentRevenueNet: number;
  projectedRevenueNet: number;
  expenseNet: number;
  estimatedTaxRate: number;
  reviewThreshold: number;
  plannedInvestments: PlannedInvestmentDTO[];
}): FinanceAssistantInsight {
  const currentProfit = roundMoney(input.currentRevenueNet - input.expenseNet);
  const projectedProfit = roundMoney(input.projectedRevenueNet - input.expenseNet);
  const projectedAdditionalRevenue = roundMoney(
    Math.max(0, input.projectedRevenueNet - input.currentRevenueNet)
  );
  const reviewThreshold = Math.max(0, input.reviewThreshold);
  const amountAboveThreshold = roundMoney(Math.max(0, projectedProfit - reviewThreshold));
  const rate = Math.min(100, Math.max(0, input.estimatedTaxRate)) / 100;

  if (projectedProfit <= reviewThreshold) {
    return {
      state: "ON_TRACK",
      eyebrow: "Alles im Blick",
      headline: "Dein Gewinn liegt innerhalb deiner Orientierung.",
      summary:
        projectedAdditionalRevenue > 0
          ? "Auch wenn alle offenen Rechnungen eingehen, wird deine hinterlegte Gewinn-Prüfschwelle voraussichtlich nicht überschritten."
          : "Aktuell besteht aus deiner hinterlegten Gewinn-Prüfschwelle kein zusätzlicher Handlungsbedarf.",
      currentProfit,
      projectedProfit,
      projectedAdditionalRevenue,
      reviewThreshold,
      amountAboveThreshold,
      investmentScenario: null,
      nextSteps: [
        "Fehlende Belege und noch nicht erfasste Ausgaben prüfen.",
        "Steuerrücklage und Liquidität getrennt im Blick behalten.",
      ],
    };
  }

  const investment = pickInvestment(
    input.plannedInvestments,
    projectedProfit,
    amountAboveThreshold
  );

  if (!investment) {
    return {
      state: "PLAN_FIRST",
      eyebrow: "Vorausschau erforderlich",
      headline: "Dein prognostizierter Gewinn liegt über deiner Prüfschwelle.",
      summary:
        "Es ist noch keine passende betriebliche Investition geplant. Erfasse nur Anschaffungen, die dein Betrieb tatsächlich benötigt, und stimme die steuerliche Behandlung ab.",
      currentProfit,
      projectedProfit,
      projectedAdditionalRevenue,
      reviewThreshold,
      amountAboveThreshold,
      investmentScenario: null,
      nextSteps: [
        "Vollständigkeit von Ausgaben und Belegen prüfen.",
        "Betrieblich notwendige Anschaffungen planen – nicht allein wegen der Steuer.",
        "Steuerliche Wirkung und Abschreibung mit dem Steuerberater klären.",
      ],
    };
  }

  const modeledDeduction = Math.min(investment.plannedAmount, Math.max(0, projectedProfit));
  const profitAfter = roundMoney(projectedProfit - modeledDeduction);
  const taxBefore = roundMoney(Math.max(0, projectedProfit) * rate);
  const taxAfter = roundMoney(Math.max(0, profitAfter) * rate);
  const needsOperationalCheck = !(
    investment.machineId ||
    investment.articleId ||
    investment.projectId
  );

  return {
    state: "REVIEW",
    eyebrow: "Jetzt sinnvoll prüfen",
    headline: `${investment.title} passt zu deiner aktuellen Finanzplanung.`,
    summary:
      "Der Copilot hat eine bereits geplante Investition gefunden. Prüfe Bedarf, Liquidität und steuerliche Behandlung, bevor du entscheidest.",
    currentProfit,
    projectedProfit,
    projectedAdditionalRevenue,
    reviewThreshold,
    amountAboveThreshold,
    investmentScenario: {
      investmentId: investment.id,
      title: investment.title,
      categoryLabel: investment.categoryLabel,
      plannedAmount: investment.plannedAmount,
      plannedDate: investment.plannedDate,
      readinessLabel:
        investment.status === "GOAL_REACHED"
          ? "Rücklage erreicht"
          : investment.progressPercent > 0
            ? `${investment.progressPercent} % zurückgelegt`
            : "Finanzierung noch prüfen",
      projectedProfitAfterImmediateDeduction: profitAfter,
      taxOrientationBefore: taxBefore,
      taxOrientationAfterImmediateDeduction: taxAfter,
      modeledTaxDifference: roundMoney(taxBefore - taxAfter),
      needsOperationalCheck,
    },
    nextSteps: [
      needsOperationalCheck
        ? "Betrieblichen Bedarf dokumentieren und einem Projekt, Artikel oder einer Maschine zuordnen."
        : "Hinterlegten betrieblichen Bedarf und geplanten Einsatz bestätigen.",
      "Zahlungseingänge, Steuerrücklage und Kaufpreis gegen die verfügbare Liquidität prüfen.",
      "Sofortabzug, Vorsteuer und mögliche Abschreibung mit dem Steuerberater bestätigen.",
    ],
  };
}
