import type { FinancePeriodPreset, FinanceRevenueBasis } from "@/lib/finance/types";

export interface RevenueOrderRow {
  orderId: string | null;
  orderNumber: string | null;
  title: string;
  customerName: string;
  date: string;
  orderStatus: string | null;
  orderStatusLabel: string | null;
  invoiceStatus: string;
  invoiceStatusLabel: string;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  paidAmount: number;
  openAmount: number;
  invoiceCount: number;
  primaryInvoiceId: string | null;
  href: string;
}

export interface RevenueMonthHistoryRow {
  key: string;
  label: string;
  year: number;
  monthIndex: number;
  from: string;
  to: string;
  revenueNet: number;
  revenueGross: number;
  vat: number;
  invoiceCount: number;
  orderCount: number;
  paidNet: number;
  paidGross: number;
  openNet: number;
  openGross: number;
}

export interface RevenueOverview {
  period: {
    preset: FinancePeriodPreset;
    from: string;
    to: string;
    label: string;
    isSingleMonth: boolean;
  };
  settings: {
    revenueBasis: FinanceRevenueBasis;
    includeUnpaidInvoices: boolean;
  };
  totals: {
    net: number;
    gross: number;
    vat: number;
    invoiceCount: number;
  };
  invoices: {
    openCount: number;
    openSumNet: number;
    openSumGross: number;
    paidCount: number;
    paidSumNet: number;
    paidSumGross: number;
    overdueCount: number;
    overdueSumNet: number;
    overdueSumGross: number;
    canceledCount: number;
    canceledSumNet: number;
    canceledSumGross: number;
  };
  orders: RevenueOrderRow[];
  /** Letzte Monate zum Zurückspringen (neueste zuerst). */
  monthHistory: RevenueMonthHistoryRow[];
}
