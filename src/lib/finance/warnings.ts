import { FINANCE_DISCLAIMERS, type FinanceWarning, type FinanceWarningThresholds } from "./types";

interface WarningInput {
  revenueNet: number;
  expenseNet: number;
  expenseCount: number;
  expensesWithoutReceipt: number;
  estimatedProfit: number;
  prevMonthProfit: number;
  openInvoiceSum: number;
  hasMaterialOrders: boolean;
  materialExpenseCount: number;
  hasMontageOrders: boolean;
  fuelExpenseCount: number;
  investmentExpenses: number;
  plannedInvestmentsCount: number;
  inventorySaleCount: number;
  thresholds: FinanceWarningThresholds;
}

export function buildFinanceWarnings(input: WarningInput): FinanceWarning[] {
  const warnings: FinanceWarning[] = [];
  const t = input.thresholds;
  const lowRatio = t.lowExpenseRatioThreshold > 0 ? t.lowExpenseRatioThreshold : 0.15;
  const highRevenue = t.highRevenueThreshold > 0 ? t.highRevenueThreshold : 3000;
  const spikeFactor = t.profitSpikeFactor > 1 ? t.profitSpikeFactor : 1.5;
  const highProfit = t.highProfitWarningThreshold ?? 5000;

  if (input.revenueNet > highRevenue && input.expenseNet < input.revenueNet * lowRatio) {
    warnings.push({
      id: "high-revenue-low-expenses",
      severity: "warning",
      title: "Wenige erfasste Ausgaben",
      message:
        "Es wurden hohe Einnahmen erfasst, aber nur wenige Material- oder Betriebsausgaben. Prüfe, ob Belege fehlen.",
    });
  }

  if (input.expensesWithoutReceipt > 0) {
    warnings.push({
      id: "missing-receipts",
      severity: "warning",
      title: "Fehlende Belege",
      message: `Es fehlen Belege zu ${input.expensesWithoutReceipt} erfassten Ausgabe${input.expensesWithoutReceipt === 1 ? "" : "n"}. Bitte prüfe, ob die Dokumentation vollständig ist.`,
    });
  }

  if (input.hasMaterialOrders && input.materialExpenseCount === 0) {
    warnings.push({
      id: "material-orders-no-receipts",
      severity: "warning",
      title: "Materialbelege prüfen",
      message:
        "Für mehrere Aufträge wurden Materialkosten kalkuliert, aber noch keine passenden Materialbelege hochgeladen.",
    });
  }

  if (input.hasMontageOrders && input.fuelExpenseCount === 0) {
    warnings.push({
      id: "montage-no-fuel",
      severity: "info",
      title: "Fahrtkosten prüfen",
      message:
        "Es wurden Fahrzeug- oder Montageaufträge durchgeführt, aber keine Tank- oder Fahrtkosten erfasst.",
    });
  }

  if (
    input.prevMonthProfit > 0 &&
    input.estimatedProfit > input.prevMonthProfit * spikeFactor &&
    input.estimatedProfit > 1000
  ) {
    warnings.push({
      id: "profit-spike",
      severity: "info",
      title: "Gewinn höher als üblich",
      message:
        "Dein geschätzter Gewinn ist diesen Monat höher als üblich. Bitte prüfe, ob alle Ausgaben und Belege vollständig erfasst wurden.",
    });
  }

  if (
    t.monthlyProfitTargetNet != null &&
    t.monthlyProfitTargetNet > 0 &&
    input.estimatedProfit > t.monthlyProfitTargetNet * 1.2
  ) {
    warnings.push({
      id: "above-profit-target",
      severity: "info",
      title: "Über dem Orientierungsziel",
      message:
        "Der geschätzte Gewinn liegt deutlich über deinem hinterlegten Zielwert für den geplanten Monatsgewinn. Das ist nur eine Orientierung — bitte Belege prüfen und steuerliche Fragen mit dem Steuerberater besprechen.",
    });
  }

  if (highProfit > 0 && input.estimatedProfit > highProfit) {
    warnings.push({
      id: "high-profit-threshold",
      severity: "info",
      title: "Hoher geschätzter Gewinn",
      message:
        "Der geschätzte Gewinn liegt über deiner hinterlegten Warnschwelle. Bitte prüfe die Vollständigkeit der Ausgaben und besprich steuerliche Aspekte bei Bedarf mit dem Steuerberater.",
    });
  }

  if (
    t.lowLiquidityWarningThreshold != null &&
    t.lowLiquidityWarningThreshold > 0 &&
    input.openInvoiceSum > t.lowLiquidityWarningThreshold
  ) {
    warnings.push({
      id: "open-invoices-liquidity",
      severity: "warning",
      title: "Offene Forderungen",
      message:
        "Die Summe offener Rechnungen liegt über deiner hinterlegten Orientierungsschwelle. Das kann die Liquidität belasten — bitte Zahlungseingänge prüfen.",
    });
  }

  if (input.investmentExpenses > 0) {
    warnings.push({
      id: "investment-depreciation",
      severity: "info",
      title: "Größere Anschaffung",
      message: FINANCE_DISCLAIMERS.depreciation,
    });
  }

  if (input.plannedInvestmentsCount > 0) {
    warnings.push({
      id: "planned-investments",
      severity: "info",
      title: "Geplante Investitionen",
      message: FINANCE_DISCLAIMERS.plannedInvestments,
    });
  }

  if (input.estimatedProfit > highProfit && input.plannedInvestmentsCount === 0) {
    warnings.push({
      id: "investment-timing",
      severity: "info",
      title: "Investitionsplanung",
      message:
        "Falls ohnehin betriebliche Investitionen geplant sind, kann es sinnvoll sein, Zeitpunkt und steuerliche Behandlung mit dem Steuerberater zu besprechen.",
    });
  }

  if (input.inventorySaleCount > 0) {
    warnings.push({
      id: "inventory-sales-documented",
      severity: "info",
      title: "Inventar-Verkäufe / Weitergaben",
      message: `Im Zeitraum wurden ${input.inventorySaleCount} Inventarentnahme(n) als Verkauf oder Weitergabe dokumentiert. Diese Werte dienen der Orientierung und fließen nicht automatisch in die Steuerberechnung ein.`,
    });
  }

  return warnings;
}
