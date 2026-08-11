import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  compareFixedPrice,
  resolveFixedPriceLabel,
  DEFAULT_FIXED_PRICE_LABEL,
  buildFixedPriceDocumentLines,
  resolveFixedPriceDisplayMode,
} from "../src/lib/calculation/fixed-price";
import { getVisibleLineItems } from "../src/lib/documents/line-items";
import type { DocumentCalcInput } from "../src/lib/documents/build-document-html";

function baseCalc(overrides: Partial<DocumentCalcInput> = {}): DocumentCalcInput {
  return {
    title: "Test",
    netSalesPrice: 400,
    vatAmount: 76,
    grossSalesPrice: 476,
    laborTotal: 250,
    materialTotal: 150,
    machineTotal: 0,
    procurementTotal: 0,
    travelTotal: 0,
    additionalTotal: 0,
    directCosts: 400,
    overheadAmount: 0,
    riskAmount: 0,
    profitAmount: 0,
    laborItems: [
      { description: "Montagearbeiten", totalNet: 250, isVisibleToCustomer: true },
    ],
    materialItems: [
      { name: "Tür", totalSalesNet: 100, isVisibleToCustomer: true },
      { name: "Acrylfarbe", totalSalesNet: 8, isVisibleToCustomer: true },
      { name: "sonstiges Material", totalSalesNet: 42, isVisibleToCustomer: true },
    ],
    travelCost: null,
    customer: null,
    ...overrides,
  };
}

describe("Festpreis – Vergleich", () => {
  it("liefert Default-Label Pauschalpreis", () => {
    assert.equal(resolveFixedPriceLabel(null), DEFAULT_FIXED_PRICE_LABEL);
    assert.equal(resolveFixedPriceLabel("  Pauschalpreis  "), "Pauschalpreis");
  });

  it("vergleicht kalkulierten Netto mit Festpreis", () => {
    const c = compareFixedPrice({
      useFixedPrice: true,
      fixedPriceNet: 500,
      fixedPriceLabel: "Pauschalpreis für Türmontage inklusive Material",
      calculatedNet: 400,
      profitAmount: 50,
      directCosts: 350,
    });
    assert.equal(c.customerNet, 500);
    assert.equal(c.calculatedNet, 400);
    assert.equal(c.difference, 100);
    assert.equal(c.estimatedProfit, 150);
    assert.ok(c.marginPercent != null && c.marginPercent > 0);
  });

  it("ohne Festpreis bleibt Kundennetto = Kalkulation", () => {
    const c = compareFixedPrice({
      useFixedPrice: false,
      fixedPriceNet: 500,
      calculatedNet: 400,
      profitAmount: 50,
      directCosts: 350,
    });
    assert.equal(c.customerNet, 400);
    assert.equal(c.difference, 0);
  });
});

describe("Festpreis – Dokumentpositionen", () => {
  it("zeigt eine Festpreis-Position statt Einzelpositionen", () => {
    const lines = getVisibleLineItems(
      baseCalc({
        useFixedPrice: true,
        fixedPriceLabel: "Pauschalpreis für Türmontage inklusive Material",
        fixedPriceDisplayMode: "SINGLE_LINE",
        netSalesPrice: 500,
        calculatedNetSalesPrice: 400,
      })
    );
    assert.equal(lines.length, 1);
    assert.equal(lines[0].amount, 500);
    assert.match(lines[0].label, /Pauschalpreis für Türmontage/);
  });

  it("zeigt Positionen mit Preisen und Ausgleich zum Festpreis", () => {
    const lines = buildFixedPriceDocumentLines({
      fixedPriceNet: 500,
      fixedPriceLabel: "Pauschalpreis",
      fixedPriceDisplayMode: "POSITIONS_WITH_PRICES",
      source: baseCalc(),
    });
    assert.ok(lines.some((l) => l.label === "Montagearbeiten"));
    assert.ok(lines.some((l) => l.label === "Tür"));
    const sum = lines.reduce((s, l) => s + (l.amount ?? 0), 0);
    assert.equal(sum, 500);
  });

  it("zeigt Positionen ohne Einzelpreise und Festpreis gesamt", () => {
    const lines = buildFixedPriceDocumentLines({
      fixedPriceNet: 1250,
      fixedPriceLabel: "Pauschale für Lieferung und Montage",
      fixedPriceDisplayMode: "DESCRIPTION_ONLY",
      source: baseCalc(),
    });
    assert.ok(lines.some((l) => l.label === "Montagearbeiten" && l.amount == null));
    const total = lines.find((l) => l.emphasis);
    assert.ok(total);
    assert.equal(total?.amount, 1250);
    assert.match(total!.label, /Festpreis gesamt/);
  });

  it("ohne Festpreis bleiben Einzelpositionen sichtbar", () => {
    const lines = getVisibleLineItems(baseCalc());
    assert.ok(lines.length >= 3);
    assert.ok(lines.some((l) => l.label === "Montagearbeiten"));
    assert.ok(lines.some((l) => l.label === "Tür"));
  });

  it("normalisiert unbekannte Display-Modi", () => {
    assert.equal(resolveFixedPriceDisplayMode("foo"), "SINGLE_LINE");
    assert.equal(resolveFixedPriceDisplayMode("DESCRIPTION_ONLY"), "DESCRIPTION_ONLY");
  });
});
