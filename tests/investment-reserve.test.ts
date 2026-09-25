import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPaceInsights,
  highRevenueHint,
  monthsUntilTarget,
  percentSumWarning,
  potSummary,
  reservePressureWarning,
  suggestReserve,
  type OrderReserveSnapshot,
} from "../src/lib/finance/investment-reserve";

const orders: OrderReserveSnapshot[] = [
  { id: "a", net: 1000, gross: 1190, contribution: 400 },
  { id: "b", net: 5000, gross: 5950, contribution: 1800 },
  { id: "c", net: 500, gross: 595, contribution: 120 },
];

describe("investment reserve math", () => {
  it("computes the virtual pot without moving money", () => {
    const pot = potSummary(30000, 12500);
    assert.equal(pot.remaining, 17500);
    assert.equal(pot.progressPercent, 41.67);
  });

  it("uses a fixed amount per completed order", () => {
    const result = suggestReserve(
      {
        savingsModel: "FIXED_PER_ORDER",
        plannedAmount: 30000,
        savedAmount: 5000,
        plannedDate: new Date("2028-07-01"),
        percentOfRevenue: null,
        amountPerOrder: 50,
        monthlyAmount: null,
        calculationBasis: "NET",
      },
      { year: 2026, month: 7 },
      orders
    );
    assert.equal(result.orderCount, 3);
    assert.equal(result.amount, 150);
    assert.match(result.explanation, /3 abgeschlossene/);
  });

  it("uses a percent of net order revenue by default", () => {
    const result = suggestReserve(
      {
        savingsModel: "PERCENT_REVENUE",
        plannedAmount: 30000,
        savedAmount: 0,
        plannedDate: null,
        percentOfRevenue: 5,
        amountPerOrder: null,
        monthlyAmount: null,
        calculationBasis: "NET",
      },
      { year: 2026, month: 7 },
      orders
    );
    assert.equal(result.basisAmount, 6500);
    assert.equal(result.amount, 325);
    assert.match(result.explanation, /Netto-Auftragsumsatz/);
  });

  it("uses contribution only when it is present", () => {
    const result = suggestReserve(
      {
        savingsModel: "PERCENT_REVENUE",
        plannedAmount: 1000,
        savedAmount: 0,
        plannedDate: null,
        percentOfRevenue: 10,
        amountPerOrder: null,
        monthlyAmount: null,
        calculationBasis: "CONTRIBUTION",
      },
      { year: 2026, month: 7 },
      [
        { id: "known", net: 1000, gross: 1190, contribution: 200 },
        { id: "missing", net: 800, gross: 952, contribution: null },
      ]
    );
    assert.equal(result.amount, 20);
    assert.equal(result.basisAvailable, false);
    assert.match(result.explanation, /fehlt Deckungsbeitrag/);
  });

  it("uses a fixed monthly amount", () => {
    const result = suggestReserve(
      {
        savingsModel: "FIXED_MONTHLY",
        plannedAmount: 12000,
        savedAmount: 0,
        plannedDate: null,
        percentOfRevenue: null,
        amountPerOrder: null,
        monthlyAmount: 500,
        calculationBasis: "NET",
      },
      { year: 2026, month: 7 },
      orders
    );
    assert.equal(result.amount, 500);
    assert.equal(result.orderCount, 0);
  });

  it("spreads the remaining target across months and respects savings already set aside", () => {
    assert.equal(monthsUntilTarget({ year: 2026, month: 7 }, new Date(2028, 6, 1)), 24);
    const result = suggestReserve(
      {
        savingsModel: "TARGET_SCHEDULE",
        plannedAmount: 24000,
        savedAmount: 4000,
        plannedDate: new Date(2028, 6, 15),
        percentOfRevenue: null,
        amountPerOrder: null,
        monthlyAmount: null,
        calculationBasis: "NET",
      },
      { year: 2026, month: 7 },
      []
    );
    assert.equal(result.amount, 833.33);
    assert.match(result.explanation, /20\.000,00 €/);
  });

  it("adds a deferred amount on top of the next month", () => {
    const result = suggestReserve(
      {
        savingsModel: "FIXED_MONTHLY",
        plannedAmount: 1000,
        savedAmount: 0,
        plannedDate: null,
        percentOfRevenue: null,
        amountPerOrder: null,
        monthlyAmount: 100,
        calculationBasis: "NET",
      },
      { year: 2026, month: 8 },
      [],
      80
    );
    assert.equal(result.amount, 180);
  });

  it("warns when the pace misses the target date", () => {
    const notes = buildPaceInsights({
      title: "Firmenfahrzeug",
      plannedAmount: 12000,
      savedAmount: 2000,
      plannedDate: new Date(2027, 6, 1),
      startDate: new Date(2026, 0, 1),
      proposal: { year: 2026, month: 7 },
      currentMonthly: 500,
      model: "FIXED_MONTHLY",
    });
    assert.ok(notes.some((n) => /später als geplant/.test(n)));
    assert.ok(notes.some((n) => /statt aktuell/.test(n)));
  });

  it("warns on high combined reserves without changing them", () => {
    assert.match(percentSumWarning(7) ?? "", /^$/);
    assert.match(percentSumWarning(30) ?? "", /nichts automatisch/);
    assert.equal(
      reservePressureWarning({
        totalSuggested: 100,
        revenueNet: 5000,
        estimatedProfit: 2000,
        taxReserve: 400,
      }),
      null
    );
    assert.match(
      reservePressureWarning({
        totalSuggested: 2000,
        revenueNet: 5000,
        estimatedProfit: 1500,
        taxReserve: 400,
      }) ?? "",
      /nichts automatisch geändert/
    );
    assert.match(highRevenueHint(8000, 4000) ?? "", /freiwillig erhöhen/);
  });
});
