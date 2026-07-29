import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveExpenseAmounts } from "../src/lib/finance/amounts";
import { expenseInputSchema } from "../src/lib/finance/schemas";
import { parseLocalDateInput } from "../src/lib/finance/period";

describe("resolveExpenseAmounts", () => {
  it("uses net + vat to compute gross", () => {
    assert.deepEqual(resolveExpenseAmounts("100", "19", ""), {
      net: 100,
      vat: 19,
      gross: 119,
    });
  });

  it("derives net from gross when net is empty", () => {
    assert.deepEqual(resolveExpenseAmounts("", "19", "119"), {
      net: 100,
      vat: 19,
      gross: 119,
    });
  });

  it("treats empty vat as 0", () => {
    assert.deepEqual(resolveExpenseAmounts("50", "", ""), {
      net: 50,
      vat: 0,
      gross: 50,
    });
  });

  it("rejects empty amounts", () => {
    assert.equal(resolveExpenseAmounts("", "", ""), null);
  });

  it("rejects negative amounts", () => {
    assert.equal(resolveExpenseAmounts("-1", "0", "0"), null);
  });
});

describe("expenseInputSchema", () => {
  it("accepts projectId and orderId", () => {
    const parsed = expenseInputSchema.safeParse({
      category: "MATERIAL",
      description: "Schrauben",
      netAmount: 10,
      vatAmount: 1.9,
      grossAmount: 11.9,
      expenseDate: "2026-07-28",
      paymentStatus: "BEZAHLT",
      orderId: "ord_1",
      projectId: "proj_1",
      isInvestment: false,
    });
    assert.equal(parsed.success, true);
  });

  it("requires description", () => {
    const parsed = expenseInputSchema.safeParse({
      category: "MATERIAL",
      description: "",
      netAmount: 10,
      vatAmount: 0,
      grossAmount: 10,
      expenseDate: "2026-07-28",
    });
    assert.equal(parsed.success, false);
  });
});

describe("expense date local parsing", () => {
  it("keeps calendar day without UTC shift", () => {
    const d = parseLocalDateInput("2026-07-01");
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 6);
    assert.equal(d.getDate(), 1);
  });
});
