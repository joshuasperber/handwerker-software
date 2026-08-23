import { FINANCE_DISCLAIMERS, type FinanceWarning, type FinanceWarningThresholds } from "./types";

export interface PlannedInvestmentHint {
  title: string;
  plannedDateLabel: string | null;
  status: string;
}

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
  plannedInvestments: PlannedInvestmentHint[];
  machineCount: number;
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
  const planned = input.plannedInvestments ?? [];
  const plannedCount = planned.length;

  if (input.revenueNet > highRevenue && input.expenseNet < input.revenueNet * lowRatio) {
    warnings.push({
      id: "high-revenue-low-expenses",
      severity: "warning",
      title: "Wenige erfasste Ausgaben",
      message:
        "Die Einnahmen sind im Zeitraum vergleichsweise hoch, die erfassten Ausgaben aber niedrig. Bitte prüfe, ob Ausgaben oder Belege fehlen — das verändert die Gewinnschätzung.",
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
        "Dein geschätzter Gewinn ist in diesem Zeitraum höher als üblich. Bitte prüfe, ob alle Ausgaben und Belege vollständig erfasst wurden.",
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
        "Der geschätzte Gewinn liegt deutlich über deinem hinterlegten Zielwert. Das ist nur eine Orientierung — bitte Belege prüfen und steuerliche Fragen mit dem Steuerberater besprechen.",
    });
  }

  if (highProfit > 0 && input.estimatedProfit > highProfit) {
    warnings.push({
      id: "high-profit-threshold",
      severity: "info",
      title: "Hoher geschätzter Gewinn",
      message: FINANCE_DISCLAIMERS.highProfit,
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
      title: "Größere Anschaffung erfasst",
      message: FINANCE_DISCLAIMERS.depreciation,
    });
  }

  if (plannedCount > 0) {
    const nextDated = planned.find((p) => p.plannedDateLabel);
    const datePart = nextDated?.plannedDateLabel
      ? ` Nächster hinterlegter Zeitpunkt: ${nextDated.plannedDateLabel} (${nextDated.title}).`
      : " Für einige Einträge ist noch kein Zeitpunkt hinterlegt.";
    warnings.push({
      id: "planned-investments",
      severity: "info",
      title: "Geplante Investitionen",
      message: `Es sind ${plannedCount} Investition${plannedCount === 1 ? "" : "en"} mit Status geplant oder verschoben hinterlegt.${datePart} Bitte prüfe mit deinem Steuerberater, ob Zeitpunkt und Behandlung relevant sind. Die App empfiehlt keinen Kauf.`,
    });
  }

  if (input.machineCount > 0) {
    warnings.push({
      id: "machines-review",
      severity: "info",
      title: "Maschinenpark prüfen",
      message: `${input.machineCount === 1 ? "Es ist eine Maschine" : `Es sind ${input.machineCount} Maschinen`} im Betrieb hinterlegt. Bitte prüfe bei Bedarf Wartung, Ersatz oder eine Neuanschaffung — nur wenn betrieblich sinnvoll, nicht zur Steueroptimierung.`,
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
