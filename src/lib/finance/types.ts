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
    "Diese Auswertung basiert auf den erfassten Daten und dient nur der Orientierung. Sie ersetzt keine steuerliche Beratung. Bitte steuerliche Entscheidungen mit dem Steuerberater prüfen.",
  taxEstimate:
    "Die geschätzte Steuerbelastung ist unverbindlich und ersetzt keine steuerliche Beratung.",
  advisor:
    "Bitte prüfe steuerliche Entscheidungen mit deinem Steuerberater.",
  investment:
    "Investitionen sollten nur aus betrieblichem Bedarf erfolgen und nicht ausschließlich zur Steuerreduzierung.",
  depreciation:
    "Größere Anschaffungen können steuerlich über mehrere Jahre abgeschrieben werden. Bitte prüfe die Behandlung mit deinem Steuerberater.",
  plannedInvestments:
    "Du hast geplante Investitionen hinterlegt. Bitte prüfe mit deinem Steuerberater, ob Zeitpunkt, Abschreibung oder Investitionsplanung relevant sind.",
  estimatesOnly:
    "Alle Werte sind Schätzungen auf Basis der erfassten Daten — keine verbindliche Steuer- oder Finanzberatung.",
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
  revenueBasis: FinanceRevenueBasis;
  includeUnpaidInvoices: boolean;
  defaultPeriodPreset: FinancePeriodPreset;
  monthlyProfitTargetNet: number | null;
  highProfitWarningThreshold: number | null;
  profitSpikeFactor: number;
  lowExpenseRatioThreshold: number;
  highRevenueThreshold: number;
  lowLiquidityWarningThreshold: number | null;
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
    invoiceCount: number;
    basis: FinanceRevenueBasis;
    includesUnpaid: boolean;
  };
  expenses: {
    net: number;
    gross: number;
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
  };
  tax: {
    estimatedRate: number;
    estimatedAmount: number;
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
}
