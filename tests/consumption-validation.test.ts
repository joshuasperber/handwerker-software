import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateConsumptionLines } from "../src/lib/inventory/consumption-validation";

describe("material consumption validation", () => {
  it("accepts finite positive consumption and returns", () => {
    assert.deepEqual(
      validateConsumptionLines([
        { lineId: "line-1", quantityConsumed: 2 },
        { lineId: "line-2", quantityConsumed: 0, returned: 1 },
      ]),
      {
        lines: [
          { lineId: "line-1", quantityConsumed: 2 },
          { lineId: "line-2", quantityConsumed: 0, returned: 1 },
        ],
      }
    );
  });

  it("rejects negative and non-finite quantities", () => {
    assert.ok("error" in validateConsumptionLines([
      { lineId: "line-1", quantityConsumed: -1 },
    ]));
    assert.ok("error" in validateConsumptionLines([
      { lineId: "line-1", quantityConsumed: Number.NaN },
    ]));
  });

  it("rejects duplicate and zero-only positions", () => {
    assert.ok("error" in validateConsumptionLines([
      { lineId: "line-1", quantityConsumed: 1 },
      { lineId: "line-1", quantityConsumed: 1 },
    ]));
    assert.ok("error" in validateConsumptionLines([
      { lineId: "line-1", quantityConsumed: 0, returned: 0 },
    ]));
  });
});
