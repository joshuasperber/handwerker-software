import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isSingleMonthPeriod,
  parseMonthInputValue,
  resolveFinancePeriod,
  resolveMonthPeriod,
  shiftMonthPeriod,
  toMonthInputValue,
} from "../src/lib/finance/period";

describe("finance period", () => {
  const now = new Date(2026, 6, 25); // 25. Juli 2026

  it("resolves current and last month", () => {
    const current = resolveFinancePeriod("current_month", null, null, now);
    assert.equal(current.from.getMonth(), 6);
    assert.equal(current.label.toLowerCase().includes("juli"), true);

    const last = resolveFinancePeriod("last_month", null, null, now);
    assert.equal(last.from.getMonth(), 5);
    assert.equal(last.label.toLowerCase().includes("juni"), true);
  });

  it("resolves current quarter", () => {
    const q = resolveFinancePeriod("current_quarter", null, null, now);
    assert.equal(q.from.getMonth(), 6);
    assert.equal(q.to.getMonth(), 8);
    assert.match(q.label, /Q3 2026/);
  });

  it("navigates months", () => {
    const july = resolveMonthPeriod(2026, 6);
    const june = shiftMonthPeriod(july.from, -1);
    assert.equal(june.from.getMonth(), 5);
    assert.equal(toMonthInputValue(june.from), "2026-06");
    const parsed = parseMonthInputValue("2026-05");
    assert.ok(parsed);
    assert.equal(parsed.from.getMonth(), 4);
  });

  it("detects single-month custom range", () => {
    const july = resolveMonthPeriod(2026, 6);
    assert.equal(isSingleMonthPeriod(july.from, july.to), true);
    assert.equal(
      isSingleMonthPeriod(july.from, resolveMonthPeriod(2026, 7).to),
      false
    );
  });
});
