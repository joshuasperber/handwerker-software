import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildProjectFinance, type CostBuckets } from "../src/lib/projects/finance";

const planned = (partial: Partial<CostBuckets> = {}): CostBuckets => ({
  material: 0,
  labor: 0,
  machines: 0,
  travel: 0,
  other: 0,
  ...partial,
});

describe("project finance", () => {
  it("adds order invoices without counting them twice", () => {
    const result = buildProjectFinance({
      orders: [
        {
          id: "a",
          orderNumber: "A",
          title: "Tür",
          materialPurchase: 400,
          laborHours: 5,
          laborCost: 150,
          laborMissingWage: false,
          planned: planned({ material: 400, labor: 200 }),
          plannedRevenue: 2000,
          plannedProfit: 800,
        },
        {
          id: "b",
          orderNumber: "B",
          title: "Fenster",
          materialPurchase: 900,
          laborHours: 4,
          laborCost: 112,
          laborMissingWage: false,
          planned: planned({ material: 900, labor: 180 }),
          plannedRevenue: 5000,
          plannedProfit: 1500,
        },
      ],
      expenses: [],
      projectCosts: [],
      invoices: [
        {
          id: "i1",
          documentNumber: "RE-1",
          status: "BEZAHLT",
          net: 2000,
          gross: 2380,
          paid: 2380,
          orderId: "a",
          calculationId: "c1",
          isClosing: false,
        },
        {
          id: "i2",
          documentNumber: "RE-2",
          status: "OFFEN",
          net: 5000,
          gross: 5950,
          paid: 0,
          orderId: "b",
          calculationId: "c2",
          isClosing: false,
        },
      ],
    });
    assert.equal(result.revenueNet, 7000);
    assert.equal(result.costs.labor, 262);
    assert.equal(result.costs.material, 1300);
    assert.equal(result.paidInvoiceGross, 2380);
    assert.equal(result.openInvoiceGross, 5950);
    assert.equal(result.doubleBillingWarning, null);
  });

  it("does not add order invoices that are already in the closing invoice", () => {
    const result = buildProjectFinance({
      orders: [
        {
          id: "a",
          orderNumber: "A",
          title: null,
          materialPurchase: 0,
          laborHours: 0,
          laborCost: 0,
          laborMissingWage: false,
          planned: planned(),
          plannedRevenue: 2000,
          plannedProfit: 0,
        },
      ],
      expenses: [{ id: "e1", category: "MATERIAL", net: 600, hasReceipt: true, orderId: null }],
      projectCosts: [
        {
          net: 600,
          source: "EXPENSE",
          expenseId: "e1",
          orderId: "a",
          invoicedCalculationId: "close",
        },
      ],
      invoices: [
        {
          id: "order-inv",
          documentNumber: "RE-A",
          status: "OFFEN",
          net: 2000,
          gross: 2380,
          paid: 0,
          orderId: "a",
          calculationId: "c1",
          isClosing: false,
        },
        {
          id: "close-inv",
          documentNumber: "RE-P",
          status: "OFFEN",
          net: 8500,
          gross: 10115,
          paid: 0,
          orderId: null,
          calculationId: "close",
          isClosing: true,
        },
      ],
    });
    assert.equal(result.revenueNet, 8500);
    assert.equal(result.costs.material, 600);
    assert.deepEqual(result.excludedOrderInvoiceNumbers, ["RE-A"]);
    assert.match(result.doubleBillingWarning ?? "", /RE-A/);
  });

  it("keeps hours visible when the wage is missing", () => {
    const result = buildProjectFinance({
      orders: [
        {
          id: "a",
          orderNumber: "A",
          title: null,
          materialPurchase: 0,
          laborHours: 3,
          laborCost: 0,
          laborMissingWage: true,
          planned: planned({ labor: 200 }),
          plannedRevenue: 0,
          plannedProfit: 0,
        },
      ],
      expenses: [],
      projectCosts: [],
      invoices: [],
    });
    assert.equal(result.costs.labor, 0);
    assert.equal(result.laborLines[0].hours, 3);
    assert.equal(result.laborLines[0].missingWage, true);
    assert.ok(result.incomplete.length > 0);
  });
});
