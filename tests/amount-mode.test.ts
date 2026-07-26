import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickAmount, amountModeLabel } from "../src/lib/amount-mode";

describe("amount mode display helpers", () => {
  it("picks gross or net without mutating source", () => {
    const amounts = { net: 100, gross: 119 };
    assert.equal(pickAmount("gross", amounts), 119);
    assert.equal(pickAmount("net", amounts), 100);
    assert.equal(amounts.net, 100);
    assert.equal(amounts.gross, 119);
  });

  it("labels modes", () => {
    assert.equal(amountModeLabel("gross"), "Brutto");
    assert.equal(amountModeLabel("net"), "Netto");
  });
});
