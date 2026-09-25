/**
 * Virtuelle Investitionsrücklage.
 * Rechnet Vorschläge aus vorhandenen Daten. Löst keine Geldbewegung aus.
 */

export const SAVINGS_MODELS = [
  "PERCENT_REVENUE",
  "FIXED_PER_ORDER",
  "FIXED_MONTHLY",
  "TARGET_SCHEDULE",
] as const;

export type InvestmentSavingsModel = (typeof SAVINGS_MODELS)[number];

export const CALCULATION_BASES = ["NET", "GROSS", "CONTRIBUTION"] as const;
export type InvestmentCalculationBasis = (typeof CALCULATION_BASES)[number];

export const RESERVE_ACTIONS = ["confirm", "adjust", "defer", "ignore"] as const;
export type ReserveAction = (typeof RESERVE_ACTIONS)[number];

/** Aufträge, die als abgeschlossen in die Rücklage eingehen. */
export const COMPLETED_ORDER_STATUSES = [
  "ABGESCHLOSSEN",
  "ABRECHNUNGSBEREIT",
  "ABGERECHNET",
] as const;

/** Nur diese Status erzeugen einen Monatsvorschlag. Pausiert zählt nicht. */
export const RESERVE_ACTIVE_STATUSES = ["PLANNED", "ACTIVE"] as const;

export const SAVINGS_MODEL_LABELS: Record<InvestmentSavingsModel, string> = {
  PERCENT_REVENUE: "Prozent vom Auftragsumsatz",
  FIXED_PER_ORDER: "Fester Betrag pro Auftrag",
  FIXED_MONTHLY: "Fester Betrag pro Monat",
  TARGET_SCHEDULE: "Automatisch nach Zielbetrag und Zieltermin",
};

export const CALCULATION_BASIS_LABELS: Record<InvestmentCalculationBasis, string> = {
  NET: "Netto-Auftragsumsatz",
  GROSS: "Brutto-Auftragsumsatz",
  CONTRIBUTION: "Deckungsbeitrag",
};

export const MONTH_LABELS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
] as const;

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function clampPercent(saved: number, target: number): number {
  if (target <= 0) return saved > 0 ? 100 : 0;
  return Math.min(100, Math.max(0, roundMoney((saved / target) * 100)));
}

export function potSummary(target: number, saved: number) {
  const safeTarget = Math.max(0, target);
  const safeSaved = Math.max(0, saved);
  const remaining = roundMoney(Math.max(0, safeTarget - safeSaved));
  return {
    target: roundMoney(safeTarget),
    saved: roundMoney(safeSaved),
    remaining,
    progressPercent: clampPercent(safeSaved, safeTarget),
  };
}

/** Monatsdifferenz vom Vorschlagsmonat bis zum Zielmonat, mindestens 1. */
export function monthsUntilTarget(proposal: { year: number; month: number }, target: Date): number {
  const diff =
    (target.getFullYear() - proposal.year) * 12 + (target.getMonth() + 1 - proposal.month);
  return Math.max(1, diff);
}

export function elapsedMonths(start: Date, proposal: { year: number; month: number }): number {
  const diff =
    (proposal.year - start.getFullYear()) * 12 + (proposal.month - (start.getMonth() + 1));
  return Math.max(1, diff + 1);
}

export function previousMonth(now: Date): { year: number; month: number } {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function monthLabel(year: number, month: number): string {
  const name = MONTH_LABELS[month - 1] ?? String(month);
  return `${name} ${year}`;
}

export function monthRange(year: number, month: number): { from: Date; to: Date } {
  const from = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const to = new Date(year, month, 0, 23, 59, 59, 999);
  return { from, to };
}

export interface OrderReserveSnapshot {
  id: string;
  net: number | null;
  gross: number | null;
  /** null = Deckungsbeitrag liegt für diesen Auftrag nicht vor */
  contribution: number | null;
}

export function basisAmount(
  order: OrderReserveSnapshot,
  basis: InvestmentCalculationBasis
): { amount: number; available: boolean } {
  if (basis === "NET") {
    return order.net != null && Number.isFinite(order.net)
      ? { amount: Math.max(0, order.net), available: true }
      : { amount: 0, available: false };
  }
  if (basis === "GROSS") {
    return order.gross != null && Number.isFinite(order.gross)
      ? { amount: Math.max(0, order.gross), available: true }
      : { amount: 0, available: false };
  }
  return order.contribution != null && Number.isFinite(order.contribution)
    ? { amount: Math.max(0, order.contribution), available: true }
    : { amount: 0, available: false };
}

export interface SavingsRule {
  savingsModel: InvestmentSavingsModel;
  plannedAmount: number;
  savedAmount: number;
  plannedDate: Date | null;
  percentOfRevenue: number | null;
  amountPerOrder: number | null;
  monthlyAmount: number | null;
  calculationBasis: InvestmentCalculationBasis;
}

export interface SuggestionResult {
  amount: number;
  orderCount: number;
  basisAmount: number;
  basisAvailable: boolean;
  explanation: string;
}

export function suggestReserve(
  rule: SavingsRule,
  proposal: { year: number; month: number },
  orders: OrderReserveSnapshot[],
  carryIn = 0
): SuggestionResult {
  const carry = roundMoney(Math.max(0, carryIn));
  const pot = potSummary(rule.plannedAmount, rule.savedAmount);

  if (rule.savingsModel === "FIXED_MONTHLY") {
    const monthly = roundMoney(Math.max(0, rule.monthlyAmount ?? 0));
    const amount = roundMoney(monthly + carry);
    return {
      amount,
      orderCount: 0,
      basisAmount: 0,
      basisAvailable: true,
      explanation:
        carry > 0
          ? `Fester Monatsbetrag ${formatPlain(monthly)} plus verschobene ${formatPlain(carry)}.`
          : `Fester Monatsbetrag ${formatPlain(monthly)}.`,
    };
  }

  if (rule.savingsModel === "TARGET_SCHEDULE") {
    if (!rule.plannedDate || rule.plannedAmount <= 0) {
      return {
        amount: carry,
        orderCount: 0,
        basisAmount: 0,
        basisAvailable: false,
        explanation:
          "Für die automatische Berechnung fehlen Zielbetrag oder Zieltermin. Es wird nur ein verschobener Betrag übernommen.",
      };
    }
    const months = monthsUntilTarget(proposal, rule.plannedDate);
    const monthly = roundMoney(pot.remaining / months);
    const amount = roundMoney(monthly + carry);
    return {
      amount,
      orderCount: 0,
      basisAmount: 0,
      basisAvailable: true,
      explanation: `Noch ${formatPlain(pot.remaining)} in ${months} Monat${months === 1 ? "" : "en"}, also ${formatPlain(monthly)} pro Monat.${
        carry > 0 ? ` Dazu ${formatPlain(carry)} aus dem Vormonat.` : ""
      }`,
    };
  }

  const basis = rule.calculationBasis;
  let summed = 0;
  let known = 0;
  let missing = 0;
  for (const order of orders) {
    const part = basisAmount(order, basis);
    if (!part.available) {
      missing += 1;
      continue;
    }
    known += 1;
    summed += part.amount;
  }
  summed = roundMoney(summed);

  if (rule.savingsModel === "FIXED_PER_ORDER") {
    const per = roundMoney(Math.max(0, rule.amountPerOrder ?? 0));
    const fromOrders = roundMoney(orders.length * per);
    const amount = roundMoney(fromOrders + carry);
    return {
      amount,
      orderCount: orders.length,
      basisAmount: summed,
      basisAvailable: missing === 0,
      explanation: `${orders.length} abgeschlossene Aufträge × ${formatPlain(per)} = ${formatPlain(fromOrders)}. Berechnungsbasis: ${CALCULATION_BASIS_LABELS[basis]} (${formatPlain(summed)}).${
        carry > 0 ? ` Dazu ${formatPlain(carry)} aus dem Vormonat.` : ""
      }`,
    };
  }

  const percent = Math.max(0, rule.percentOfRevenue ?? 0);
  const fromOrders = roundMoney(summed * (percent / 100));
  const amount = roundMoney(fromOrders + carry);
  const basisName = CALCULATION_BASIS_LABELS[basis];
  const missingNote =
    missing > 0
      ? ` Bei ${missing} Auftrag${missing === 1 ? "" : "en"} fehlt ${basisName}. Diese fließen nicht ein.`
      : "";
  return {
    amount,
    orderCount: known,
    basisAmount: summed,
    basisAvailable: missing === 0,
    explanation: `${percent} % von ${formatPlain(summed)} ${basisName} (${known} Aufträge) = ${formatPlain(fromOrders)}.${missingNote}${
      carry > 0 ? ` Dazu ${formatPlain(carry)} aus dem Vormonat.` : ""
    }`,
  };
}

function formatPlain(amount: number): string {
  return `${roundMoney(amount).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

export interface PaceInsightInput {
  title: string;
  plannedAmount: number;
  savedAmount: number;
  plannedDate: Date | null;
  startDate: Date | null;
  proposal: { year: number; month: number };
  currentMonthly: number;
  model: InvestmentSavingsModel;
}

export function buildPaceInsights(input: PaceInsightInput): string[] {
  const notes: string[] = [];
  const pot = potSummary(input.plannedAmount, input.savedAmount);
  if (pot.remaining <= 0 || !input.plannedDate) return notes;

  const monthsLeft = monthsUntilTarget(input.proposal, input.plannedDate);
  const required = roundMoney(pot.remaining / monthsLeft);
  const start = input.startDate;
  if (start && input.savedAmount > 0) {
    const elapsed = elapsedMonths(start, input.proposal);
    const pace = input.savedAmount / elapsed;
    if (pace > 0) {
      const projected = pot.remaining / pace;
      const delay = Math.round(projected - monthsLeft);
      if (delay >= 1) {
        notes.push(
          `Bei deinem aktuellen Rücklagetempo erreichst du „${input.title}“ voraussichtlich ${delay} Monat${delay === 1 ? "" : "e"} später als geplant.`
        );
      }
    }
  }

  if (
    input.model === "FIXED_MONTHLY" &&
    input.currentMonthly > 0 &&
    required > input.currentMonthly + 0.5
  ) {
    notes.push(
      `Um „${input.title}“ zum gewünschten Termin zu erreichen, wären durchschnittlich ${formatPlain(required)} statt aktuell ${formatPlain(input.currentMonthly)} pro Monat notwendig.`
    );
  } else if (input.model === "TARGET_SCHEDULE") {
    notes.push(
      `Automatischer Vorschlag für „${input.title}“: ${formatPlain(required)} pro Monat bis zum Zieltermin.`
    );
  }

  return notes;
}

export function highRevenueHint(currentRevenue: number, previousRevenue: number): string | null {
  if (previousRevenue <= 0 || currentRevenue <= previousRevenue * 1.3) return null;
  return "Dieser Monat hatte einen höheren Umsatz als üblich. Du könntest die geplante Investitionsrücklage freiwillig erhöhen.";
}

/**
 * Warnt, ändert aber nichts.
 * Schwelle: Vorschlag über 30 % des Nettoumsatzes oder über dem geschätzten Gewinn nach Steuerrücklage.
 */
export function reservePressureWarning(input: {
  totalSuggested: number;
  revenueNet: number;
  estimatedProfit: number;
  taxReserve: number;
}): string | null {
  const suggested = roundMoney(input.totalSuggested);
  if (suggested <= 0) return null;
  const revenue = input.revenueNet;
  const liquidity = roundMoney(input.estimatedProfit - Math.max(0, input.taxReserve));
  const highVsRevenue = revenue > 0 && suggested > revenue * 0.3;
  const highVsLiquidity = liquidity > 0 && suggested > liquidity;
  if (!highVsRevenue && !highVsLiquidity) return null;
  return "Deine geplanten Investitionsrücklagen sind im Verhältnis zur aktuellen Liquidität oder zum Umsatz hoch. Bitte prüfe den Betrag. Es wird nichts automatisch geändert.";
}

export function percentSumWarning(totalPercent: number): string | null {
  if (totalPercent <= 25) return null;
  return `Die prozentualen Rücklagen summieren sich auf ${roundMoney(totalPercent).toLocaleString("de-DE")} % des Auftragsumsatzes. Bitte prüfe, ob das zum Umsatz passt. Es wird nichts automatisch geändert.`;
}
