import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planOrderedQuantityRelease } from "../src/lib/inventory/purchase-order-stock";

describe("planOrderedQuantityRelease", () => {
  it("reduces the preferred location first and never below zero", () => {
    const result = planOrderedQuantityRelease(
      [
        { id: "other", storageLocationId: "vehicle", orderedQuantity: 4 },
        { id: "main", storageLocationId: "main", orderedQuantity: 3 },
      ],
      5,
      "main"
    );

    assert.deepEqual(result, [
      { id: "main", nextOrderedQuantity: 0 },
      { id: "other", nextOrderedQuantity: 2 },
    ]);
  });

  it("does not create negative quantities when more is received than tracked", () => {
    const result = planOrderedQuantityRelease(
      [{ id: "main", storageLocationId: "main", orderedQuantity: 2 }],
      10,
      "main"
    );

    assert.deepEqual(result, [{ id: "main", nextOrderedQuantity: 0 }]);
  });
});
