import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { articlePriceForCalculation, normalizeUnitLabel, isPresetUnit } from "../src/lib/inventory/units";
import { calcMaterialItemSales, calcMaterialTotal } from "../src/lib/calculation/formulas";

describe("inventory units & prices", () => {
  it("normalizes common unit aliases", () => {
    assert.equal(normalizeUnitLabel("Stk"), "Stück");
    assert.equal(normalizeUnitLabel("kg"), "Kilogramm");
    assert.equal(normalizeUnitLabel("100er-Set"), "100er-Set");
  });

  it("detects preset units", () => {
    assert.equal(isPresetUnit("Stück"), true);
    assert.equal(isPresetUnit("Stk"), true);
    assert.equal(isPresetUnit("Rolle"), false);
  });

  it("prefers salesPriceNet for calculation", () => {
    assert.equal(
      articlePriceForCalculation({ purchasePriceNet: 8, salesPriceNet: 10 }),
      10
    );
    assert.equal(
      articlePriceForCalculation({ purchasePriceNet: 8, salesPriceNet: null }),
      8
    );
    assert.equal(articlePriceForCalculation({}), 0);
  });
});

describe("material line totals", () => {
  it("computes purchase and sales with markup", () => {
    const line = calcMaterialItemSales(2, 100, 25, 0);
    assert.equal(line.purchase, 200);
    assert.equal(line.sales, 250);
  });

  it("sums material positions", () => {
    const total = calcMaterialTotal([
      { quantity: 1, purchasePriceNet: 100, markupPercent: 0 },
      { quantity: 2, purchasePriceNet: 8, markupPercent: 0 },
    ]);
    assert.equal(total, 116);
  });
});
