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

const baseInput = {
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
  plannedInvestments: [] as { title: string; plannedDateLabel: string | null; status: string }[],
  machineCount: 0,
  inventorySaleCount: 0,
  thresholds: baseThresholds,
};

describe("finance warnings (Steuer-Radar)", () => {
  it("flags high revenue with few expenses carefully", () => {
    const warnings = buildFinanceWarnings(baseInput);
    const lowExp = warnings.find((w) => w.id === "high-revenue-low-expenses");
    assert.ok(lowExp);
    assert.match(lowExp!.message, /Belege fehlen|Ausgaben oder Belege fehlen/i);
    assert.doesNotMatch(lowExp!.message, /Kaufe jetzt|Steuern sparen/i);
  });

  it("gives a serious high-profit hint without pushing a purchase", () => {
    const warnings = buildFinanceWarnings({
      ...baseInput,
      revenueNet: 10000,
      expenseNet: 2000,
      expenseCount: 5,
      estimatedProfit: 8000,
      prevMonthProfit: 3000,
    });
    const high = warnings.find((w) => w.id === "high-profit-threshold");
    assert.ok(high);
    assert.equal(high!.message, FINANCE_DISCLAIMERS.highProfit);
    assert.match(high!.message, /Steuerberater/i);
    assert.match(high!.message, /Belege vollständig/i);
    assert.doesNotMatch(high!.message, /Kaufe jetzt|garantiert|Steuerersparnis/i);
    assert.equal(warnings.some((w) => w.id === "investment-timing"), false);
  });

  it("mentions planned investment timing when entries exist", () => {
    const warnings = buildFinanceWarnings({
      ...baseInput,
      expenseNet: 2000,
      estimatedProfit: 4000,
      plannedInvestments: [
        { title: "Fliesenmaschine", plannedDateLabel: "15.09.2026", status: "PLANNED" },
      ],
    });
    const planned = warnings.find((w) => w.id === "planned-investments");
    assert.ok(planned);
    assert.match(planned!.message, /15\.09\.2026/);
    assert.match(planned!.message, /Fliesenmaschine/);
    assert.match(planned!.message, /empfiehlt keinen Kauf/i);
  });

  it("hints to review machines without recommending a tax-driven buy", () => {
    const warnings = buildFinanceWarnings({
      ...baseInput,
      expenseNet: 2000,
      estimatedProfit: 4000,
      machineCount: 3,
    });
    const machines = warnings.find((w) => w.id === "machines-review");
    assert.ok(machines);
    assert.match(machines!.message, /Wartung, Ersatz oder eine Neuanschaffung/);
    assert.doesNotMatch(machines!.message, /Kaufe jetzt|Steuern sparen/i);
  });

  it("respects monthly profit orientation target", () => {
    const warnings = buildFinanceWarnings({
      ...baseInput,
      revenueNet: 6000,
      expenseNet: 1000,
      expenseCount: 3,
      estimatedProfit: 5000,
      prevMonthProfit: 4000,
      plannedInvestments: [
        { title: "Werkzeug", plannedDateLabel: null, status: "PLANNED" },
      ],
      thresholds: { ...baseThresholds, monthlyProfitTargetNet: 2000 },
    });
    assert.ok(warnings.some((w) => w.id === "above-profit-target"));
  });

  it("disclaimers state non-binding orientation", () => {
    assert.match(FINANCE_DISCLAIMERS.overview, /unverbindliche Orientierung/i);
    assert.match(FINANCE_DISCLAIMERS.overview, /ersetzt keine steuerliche Beratung/i);
    assert.match(FINANCE_DISCLAIMERS.taxEstimate, /unverbindlich/i);
    assert.doesNotMatch(FINANCE_DISCLAIMERS.highProfit, /Kaufe jetzt/);
  });
});
