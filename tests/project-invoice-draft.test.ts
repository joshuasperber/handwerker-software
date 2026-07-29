import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Pure helpers mirroring project-invoice draft rules (ohne Prisma).
 */

function calcHasBillableContent(calc: {
  useFixedPrice: boolean;
  fixedPriceNet: number | null;
  laborItems: Array<{ totalNet: number; hours: number }>;
  materialItems: Array<{ totalSalesNet: number; quantity: number }>;
  machineUsages: Array<{ totalNet: number; usageHours: number }>;
  travelCost: { totalNet: number } | null;
  additionalItems: Array<{ totalNet: number }>;
  procurementCosts: Array<{ totalNet: number }>;
}): boolean {
  if (
    calc.useFixedPrice &&
    calc.fixedPriceNet != null &&
    Number.isFinite(calc.fixedPriceNet)
  ) {
    return true;
  }
  if (calc.laborItems.some((l) => Math.abs(l.totalNet) >= 0.001 || l.hours > 0)) return true;
  if (calc.materialItems.some((m) => Math.abs(m.totalSalesNet) >= 0.001 || m.quantity > 0)) {
    return true;
  }
  if (calc.machineUsages.some((m) => Math.abs(m.totalNet) >= 0.001 || m.usageHours > 0)) {
    return true;
  }
  if (calc.travelCost && Math.abs(calc.travelCost.totalNet) >= 0.001) return true;
  if (calc.additionalItems.some((a) => Math.abs(a.totalNet) >= 0.001)) return true;
  if (calc.procurementCosts.some((p) => Math.abs(p.totalNet) >= 0.001)) return true;
  return false;
}

function preferWholeOrder(
  selectedOrderIds: Set<string>,
  orderId: string,
  granularSelected: boolean
): "whole" | "granular" | "skip" {
  if (selectedOrderIds.has(orderId)) return "whole";
  if (granularSelected) return "granular";
  return "skip";
}

describe("project invoice draft rules", () => {
  it("erkennt leere Kalkulationen als nicht billable", () => {
    assert.equal(
      calcHasBillableContent({
        useFixedPrice: false,
        fixedPriceNet: null,
        laborItems: [],
        materialItems: [],
        machineUsages: [],
        travelCost: null,
        additionalItems: [],
        procurementCosts: [],
      }),
      false
    );
  });

  it("erkennt Festpreis als billable", () => {
    assert.equal(
      calcHasBillableContent({
        useFixedPrice: true,
        fixedPriceNet: 500,
        laborItems: [],
        materialItems: [],
        machineUsages: [],
        travelCost: null,
        additionalItems: [],
        procurementCosts: [],
      }),
      true
    );
  });

  it("erkennt Labor-/Materialpositionen", () => {
    assert.equal(
      calcHasBillableContent({
        useFixedPrice: false,
        fixedPriceNet: null,
        laborItems: [{ totalNet: 120, hours: 2 }],
        materialItems: [],
        machineUsages: [],
        travelCost: null,
        additionalItems: [],
        procurementCosts: [],
      }),
      true
    );
  });

  it("ganzer Auftrag hat Vorrang vor Einzelpositionen", () => {
    const selected = new Set(["o1"]);
    assert.equal(preferWholeOrder(selected, "o1", true), "whole");
    assert.equal(preferWholeOrder(new Set(), "o1", true), "granular");
    assert.equal(preferWholeOrder(new Set(), "o1", false), "skip");
  });
});
