import assert from "node:assert/strict";
import test from "node:test";
import { determineMaterialOrderStatus } from "../src/lib/inventory/order-material-status";

test("material status is calculated from batched availability", () => {
  const lines = [
    { articleId: "article-1", quantityRequired: 2 },
    { articleId: "article-2", quantityRequired: 4 },
  ];

  assert.equal(
    determineMaterialOrderStatus(
      lines,
      new Map([
        ["article-1", 2],
        ["article-2", 4],
      ])
    ),
    "COMPLETE"
  );
  assert.equal(
    determineMaterialOrderStatus(lines, new Map([["article-1", 1]])),
    "MISSING"
  );
});

test("material without an inventory article remains partly available", () => {
  assert.equal(
    determineMaterialOrderStatus(
      [{ articleId: null, quantityRequired: 1 }],
      new Map()
    ),
    "PARTLY_AVAILABLE"
  );
  assert.equal(determineMaterialOrderStatus([], new Map()), "NOT_CHECKED");
});
