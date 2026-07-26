import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calcDocumentedUnitMargin,
  isSaleLikeReason,
  withdrawalMovementType,
  REASON_LABELS,
} from "../src/lib/inventory/reasons";

describe("inventory withdrawal reasons", () => {
  it("maps reasons to movement types", () => {
    assert.equal(withdrawalMovementType("AUFTRAG"), "VERBRAUCH");
    assert.equal(withdrawalMovementType("VERKAUF"), "ABGANG");
    assert.equal(withdrawalMovementType("WEITERGABE"), "ABGANG");
  });

  it("detects sale-like reasons", () => {
    assert.equal(isSaleLikeReason("VERKAUF"), true);
    assert.equal(isSaleLikeReason("WEITERGABE"), true);
    assert.equal(isSaleLikeReason("AUFTRAG"), false);
  });

  it("documents unit margin without tax logic", () => {
    assert.equal(calcDocumentedUnitMargin(10, 15), 5);
    assert.equal(calcDocumentedUnitMargin(10, 8), -2);
    assert.equal(calcDocumentedUnitMargin(null, 15), null);
    assert.equal(calcDocumentedUnitMargin(10, null), null);
  });

  it("has labels for all common reasons", () => {
    for (const key of ["AUFTRAG", "VERKAUF", "WEITERGABE", "EINKAUF", "BESCHAEDIGT"]) {
      assert.ok(REASON_LABELS[key]);
    }
  });
});
