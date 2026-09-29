import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildFinanceAssistantInsight,
  buildReceivablesProjection,
} from "../src/lib/finance/assistant";
import type { PlannedInvestmentDTO } from "../src/lib/finance/types";

function investment(overrides: Partial<PlannedInvestmentDTO> = {}): PlannedInvestmentDTO {
  return {
    id: "inv-1",
    title: "Neue Fliesenschneidemaschine",
    plannedAmount: 800,
    plannedDate: "2026-10-15T00:00:00.000Z",
    category: "MACHINE",
    categoryLabel: "Maschine",
    note: "Ersatz für defektes Gerät",
    status: "ACTIVE",
    statusLabel: "Aktiv",
    machineId: "machine-1",
    machineName: "Alte Fliesenschneidemaschine",
    articleId: null,
    articleName: null,
    projectId: null,
    projectName: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    savedAmount: 400,
    remainingAmount: 400,
    progressPercent: 50,
    startDate: "2026-09-01T00:00:00.000Z",
    savingsModel: "TARGET_SCHEDULE",
    savingsModelLabel: "Bis zum Zieltermin",
    percentOfRevenue: null,
    amountPerOrder: null,
    monthlyAmount: null,
    calculationBasis: "NET",
    calculationBasisLabel: "Netto-Umsatz",
    monthSuggestion: 400,
    monthSuggestionLabel: "September 2026",
    suggestionExplanation: null,
    hints: [],
    ...overrides,
  };
}

describe("finance assistant", () => {
  it("projects payment-date revenue when all open invoices arrive", () => {
    const from = new Date("2026-09-01T00:00:00.000Z");
    const to = new Date("2026-09-30T23:59:59.999Z");
    const result = buildReceivablesProjection({
      currentRevenueNet: 1000,
      revenueBasis: "PAYMENT_DATE",
      period: { from, to },
      invoices: [
        {
          status: "TEILBEZAHLT",
          netAmount: 2000,
          grossAmount: 2380,
          paidAmount: 1190,
          issueDate: new Date("2026-08-20T00:00:00.000Z"),
          payments: [{ amount: 1190, paidAt: new Date("2026-09-05T00:00:00.000Z") }],
        },
      ],
    });

    assert.equal(result.projectedRevenueNet, 2000);
    assert.equal(result.additionalReceivablesNet, 1000);
  });

  it("recommends reviewing an existing operational investment above the threshold", () => {
    const result = buildFinanceAssistantInsight({
      currentRevenueNet: 4200,
      projectedRevenueNet: 5000,
      expenseNet: 0,
      estimatedTaxRate: 30,
      reviewThreshold: 4500,
      plannedInvestments: [investment()],
    });

    assert.equal(result.state, "REVIEW");
    assert.equal(result.projectedProfit, 5000);
    assert.equal(result.amountAboveThreshold, 500);
    assert.equal(result.investmentScenario?.title, "Neue Fliesenschneidemaschine");
    assert.equal(result.investmentScenario?.projectedProfitAfterImmediateDeduction, 4200);
    assert.equal(result.investmentScenario?.modeledTaxDifference, 240);
    assert.equal(result.investmentScenario?.needsOperationalCheck, false);
    assert.match(result.nextSteps.join(" "), /Steuerberater/);
  });

  it("does not invent a purchase when no investment is planned", () => {
    const result = buildFinanceAssistantInsight({
      currentRevenueNet: 5000,
      projectedRevenueNet: 5000,
      expenseNet: 0,
      estimatedTaxRate: 30,
      reviewThreshold: 4500,
      plannedInvestments: [],
    });

    assert.equal(result.state, "PLAN_FIRST");
    assert.equal(result.investmentScenario, null);
    assert.match(result.summary, /tatsächlich benötigt/);
  });

  it("shows an on-track state below the configured threshold", () => {
    const result = buildFinanceAssistantInsight({
      currentRevenueNet: 3500,
      projectedRevenueNet: 4200,
      expenseNet: 500,
      estimatedTaxRate: 30,
      reviewThreshold: 4500,
      plannedInvestments: [investment()],
    });

    assert.equal(result.state, "ON_TRACK");
    assert.equal(result.investmentScenario, null);
  });
});
