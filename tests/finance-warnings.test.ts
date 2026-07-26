import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildFinanceWarnings } from "../src/lib/finance/warnings";
import { FINANCE_DISCLAIMERS } from "../src/lib/finance/types";

const baseThresholds = {
  highRevenueThreshold: 3000,
  lowExpenseRatioThreshold: 0.15,
  profitSpikeFactor: 1.5,
  highProfitWarningThreshold: 5000,
  monthlyProfitTargetNet: null as number | null,
  lowLiquidityWarningThreshold: null as number | null,
};

describe("finance warnings (Steuer-Radar)", () => {
  it("flags high revenue with few expenses carefully", () => {
    const warnings = buildFinanceWarnings({
      revenueNet: 8000,
      expenseNet: 200,
      expenseCount: 1,
      expensesWithoutReceipt: 0,
      estimatedProfit: 7800,
      prevMonthProfit: 2000,
      openInvoiceSum: 0,
      hasMaterialOrders: false,
      materialExpenseCount: 0,
      hasMontageOrders: false,
      fuelExpenseCount: 0,
      investmentExpenses: 0,
      plannedInvestmentsCount: 0,
      inventorySaleCount: 0,
      thresholds: baseThresholds,
    });
    const lowExp = warnings.find((w) => w.id === "high-revenue-low-expenses");
    assert.ok(lowExp);
    assert.match(lowExp!.message, /Belege fehlen/i);
    assert.doesNotMatch(lowExp!.message, /Kaufe jetzt|Steuern sparen/i);
  });

  it("mentions tax advisor for investment timing, never pushes purchase", () => {
    const warnings = buildFinanceWarnings({
      revenueNet: 10000,
      expenseNet: 2000,
      expenseCount: 5,
      expensesWithoutReceipt: 0,
      estimatedProfit: 8000,
      prevMonthProfit: 3000,
      openInvoiceSum: 0,
      hasMaterialOrders: false,
      materialExpenseCount: 0,
      hasMontageOrders: false,
      fuelExpenseCount: 0,
      investmentExpenses: 0,
      plannedInvestmentsCount: 0,
      inventorySaleCount: 0,
      thresholds: baseThresholds,
    });
    const timing = warnings.find((w) => w.id === "investment-timing");
    assert.ok(timing);
    assert.match(timing!.message, /Steuerberater/i);
    assert.doesNotMatch(timing!.message, /Kaufe jetzt|garantiert|Steuerersparnis/i);
  });

  it("respects monthly profit orientation target", () => {
    const warnings = buildFinanceWarnings({
      revenueNet: 6000,
      expenseNet: 1000,
      expenseCount: 3,
      expensesWithoutReceipt: 0,
      estimatedProfit: 5000,
      prevMonthProfit: 4000,
      openInvoiceSum: 0,
      hasMaterialOrders: false,
      materialExpenseCount: 0,
      hasMontageOrders: false,
      fuelExpenseCount: 0,
      investmentExpenses: 0,
      plannedInvestmentsCount: 1,
      inventorySaleCount: 0,
      thresholds: { ...baseThresholds, monthlyProfitTargetNet: 2000 },
    });
    assert.ok(warnings.some((w) => w.id === "above-profit-target"));
  });

  it("disclaimers state non-binding orientation", () => {
    assert.match(FINANCE_DISCLAIMERS.overview, /Orientierung/i);
    assert.match(FINANCE_DISCLAIMERS.overview, /Steuerberater/i);
    assert.match(FINANCE_DISCLAIMERS.taxEstimate, /unverbindlich/i);
  });
});
