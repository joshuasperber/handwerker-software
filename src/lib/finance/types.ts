import type {
  ExpenseCategory,
  ExpensePaymentStatus,
  FinanceRevenueBasis,
  PlannedInvestmentCategory,
  PlannedInvestmentStatus,
} from "@/generated/prisma/client";

export type { FinanceRevenueBasis };

export type FinancePeriodPreset =
  | "current_month"
  | "last_month"
  | "current_quarter"
  | "last_quarter"
  | "current_year"
  | "custom";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  MATERIAL: "Material",
  MACHINERY: "Maschinen",
  TOOLS: "Werkzeuge",
  FUEL: "Kraftstoff / Tankbelege",
  VEHICLES: "Fahrzeuge",
  RENT: "Miete / Lager / Büro",
  SUBCONTRACTOR: "Subunternehmer",
  INSURANCE: "Versicherungen",
  SOFTWARE: "Software / Lizenzen",
  TELECOM: "Telefon / Internet",
  OTHER: "Sonstige Betriebsausgaben",
};

export const EXPENSE_PAYMENT_STATUS_LABELS: Record<ExpensePaymentStatus, string> = {
  OFFEN: "Offen",
  BEZAHLT: "Bezahlt",
};

export const REVENUE_BASIS_LABELS: Record<FinanceRevenueBasis, string> = {
  ISSUE_DATE: "Rechnungsdatum",
  PAYMENT_DATE: "Zahlungseingang",
};

export const INVESTMENT_CATEGORY_LABELS: Record<PlannedInvestmentCategory, string> = {
  MACHINE: "Maschine",
  TOOL: "Werkzeug",
  VEHICLE: "Fahrzeug",
  SOFTWARE: "Software",
  MATERIAL_BULK: "Materialgroßeinkauf",
  OTHER: "Sonstige Investition",
};

export const INVESTMENT_STATUS_LABELS: Record<PlannedInvestmentStatus, string> = {
  PLANNED: "Geplant",
  PURCHASED: "Gekauft",
  POSTPONED: "Verschoben",
  CANCELLED: "Verworfen",
};

export const FINANCE_DISCLAIMERS = {
  overview:
    "Diese Auswertung ist eine unverbindliche Orientierung auf Basis der erfassten Daten und ersetzt keine steuerliche Beratung.",
  taxEstimate:
    "Die geschätzte Steuerbelastung ist unverbindlich und ersetzt keine steuerliche Beratung.",
  advisor:
    "Bitte prüfe steuerliche Entscheidungen mit deinem Steuerberater.",
  investment:
    "Investitionen sollten nur aus betrieblichem Bedarf erfolgen — nicht allein, um Steuern zu reduzieren. Die App gibt keine Kaufempfehlung.",
  depreciation:
    "Größere Anschaffungen können steuerlich über mehrere Jahre abgeschrieben werden. Bitte prüfe die Behandlung mit deinem Steuerberater.",
  plannedInvestments:
    "Du hast geplante Investitionen hinterlegt. Bitte prüfe mit deinem Steuerberater, ob Zeitpunkt, Abschreibung oder Investitionsplanung relevant sind.",
  estimatesOnly:
    "Diese Auswertung ist eine unverbindliche Orientierung auf Basis der erfassten Daten und ersetzt keine steuerliche Beratung.",
  highProfit:
    "Dein geschätzter Gewinn ist aktuell hoch. Bitte prüfe, ob alle Ausgaben und Belege vollständig erfasst wurden. Falls ohnehin betriebliche Investitionen geplant sind, kann es sinnvoll sein, Zeitpunkt und steuerliche Behandlung mit dem Steuerberater abzustimmen.",
  whenToInvest:
    "Geplante oder umgesetzte Investitionen sollten zum betrieblichen Bedarf passen (Ersatz, Wartung, Wachstum). Die App sagt nicht, dass jetzt etwas gekauft werden soll, um Steuern zu sparen.",
} as const;

export interface FinanceWarningThresholds {
  highRevenueThreshold: number;
  lowExpenseRatioThreshold: number;
  profitSpikeFactor: number;
  highProfitWarningThreshold: number | null;
  monthlyProfitTargetNet: number | null;
  lowLiquidityWarningThreshold: number | null;
}

export interface FinanceSettingsDTO {
  estimatedTaxRate: number;
  /** Gewünschte Rücklage in % vom geschätzten Gewinn; null → Steuersatz */
  reservePercent: number | null;
  revenueBasis: FinanceRevenueBasis;
  includeUnpaidInvoices: boolean;
  defaultPeriodPreset: FinancePeriodPreset;
  monthlyProfitTargetNet: number | null;
  highProfitWarningThreshold: number | null;
  profitSpikeFactor: number;
  lowExpenseRatioThreshold: number;
  highRevenueThreshold: number;
  lowLiquidityWarningThreshold: number | null;
  vatRegistered: boolean;
  kleinunternehmer: boolean;
  hasTaxAdvisor: boolean;
  profileNote: string | null;
}

export interface ExpenseDTO {
  id: string;
  category: ExpenseCategory;
  categoryLabel: string;
  description: string;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  expenseDate: string;
  paymentStatus: ExpensePaymentStatus;
  paymentStatusLabel: string;
  supplier: string | null;
  orderId: string | null;
  customerId: string | null;
  projectId: string | null;
  internalNote: string | null;
  hasReceipt: boolean;
  receiptFileName: string | null;
  isInvestment: boolean;
  createdAt: string;
}

export interface PlannedInvestmentDTO {
  id: string;
  title: string;
  plannedAmount: number;
  plannedDate: string | null;
  category: PlannedInvestmentCategory;
  categoryLabel: string;
  note: string | null;
  status: PlannedInvestmentStatus;
  statusLabel: string;
  machineId: string | null;
  machineName: string | null;
  articleId: string | null;
  articleName: string | null;
  projectId: string | null;
  projectName: string | null;
  createdAt: string;
}

export interface FinanceWarning {
  id: string;
  severity: "info" | "warning";
  title: string;
  message: string;
}

export interface CategoryBreakdown {
  category: ExpenseCategory;
  label: string;
  amount: number;
  count: number;
  withReceipt: number;
  withoutReceipt: number;
}

export interface InvoiceSummary {
  openCount: number;
  openSum: number;
  overdueCount: number;
  overdueSum: number;
  paidCount: number;
  paidSum: number;
  canceledCount: number;
}

export interface FinanceOverview {
  period: {
    preset: FinancePeriodPreset;
    from: string;
    to: string;
    label: string;
  };
  settings: FinanceSettingsDTO;
  revenue: {
    net: number;
    gross: number;
    vat: number;
    invoiceCount: number;
    basis: FinanceRevenueBasis;
    includesUnpaid: boolean;
  };
  expenses: {
    net: number;
    gross: number;
    vat: number;
    count: number;
    withReceipt: number;
    withoutReceipt: number;
    byCategory: CategoryBreakdown[];
  };
  profit: {
    estimatedNet: number;
    isEstimate: true;
    targetNet: number | null;
    targetDelta: number | null;
    /** Nachvollziehbare Formel für die UI */
    formulaLabel: string;
  };
  tax: {
    estimatedRate: number;
    estimatedAmount: number;
    /** Empfohlene Rücklage (unverbindlich) */
    recommendedReserve: number;
    reservePercentUsed: number;
    isEstimate: true;
  };
  invoices: InvoiceSummary;
  inventorySales: {
    count: number;
    documentedSaleNet: number;
  };
  warnings: FinanceWarning[];
  recentExpenses: ExpenseDTO[];
  plannedInvestments: PlannedInvestmentDTO[];
  machineCount: number;
}
