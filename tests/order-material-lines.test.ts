import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeOrderMaterialLineInput,
  resolveMaterialLineUnitPrice,
} from "../src/lib/orders/material-lines";

describe("order material lines", () => {
  it("normalizes inventory and free lines", () => {
    const inv = normalizeOrderMaterialLineInput({
      articleId: "a1",
      name: "Schraube",
      quantityRequired: 10,
      unit: "Stück",
      unitPriceNet: 0.12,
    });
    assert.ok(inv);
    assert.equal(inv!.articleId, "a1");
    assert.equal(inv!.unitPriceNet, 0.12);

    const free = normalizeOrderMaterialLineInput({
      name: "Sonderteil",
      quantity: 2,
      unit: "Set",
      priceNet: 25,
      notes: "Kunde stellt nicht",
    });
    assert.ok(free);
    assert.equal(free!.articleId, null);
    assert.equal(free!.quantityRequired, 2);
    assert.equal(free!.unitPriceNet, 25);
  });

  it("rejects empty name or invalid quantity", () => {
    assert.equal(normalizeOrderMaterialLineInput({ name: "", quantityRequired: 1 }), null);
    assert.equal(normalizeOrderMaterialLineInput({ name: "X", quantityRequired: 0 }), null);
  });

  it("resolves unit price preferring override", () => {
    assert.equal(
      resolveMaterialLineUnitPrice({
        unitPriceNet: 9.5,
        article: { salesPriceNet: 12, purchasePriceNet: 8 },
      }),
      9.5
    );
    assert.equal(
      resolveMaterialLineUnitPrice({
        unitPriceNet: null,
        article: { salesPriceNet: 12, purchasePriceNet: 8 },
      }),
      12
    );
    assert.equal(resolveMaterialLineUnitPrice({ unitPriceNet: null, article: null }), 0);
  });
});
