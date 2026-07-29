import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Leichtgewichtiger Smoke-Test der Gruppierungslogik (reine Hilfsfunktion lokal).
 * Die schwere Prisma-Logik wird manuell über die Projekt-UI geprüft.
 */
function groupLines(
  lines: Array<{ orderId: string | null; orderLabel: string | null; netAmount: number; label: string }>
) {
  const map = new Map<
    string,
    { orderId: string | null; orderLabel: string; lines: typeof lines }
  >();
  for (const line of lines) {
    const key = line.orderId ?? "__project__";
    const label = line.orderLabel ?? "Projektkosten";
    if (!map.has(key)) map.set(key, { orderId: line.orderId, orderLabel: label, lines: [] });
    map.get(key)!.lines.push(line);
  }
  return [...map.values()].map((g) => ({
    ...g,
    subtotalNet: g.lines.reduce((s, l) => s + l.netAmount, 0),
  }));
}

describe("project invoice grouping", () => {
  it("gruppiert Positionen nach Auftrag (Variante A)", () => {
    const groups = groupLines([
      { orderId: "1", orderLabel: "A-1 · Tür", label: "Leistung", netAmount: 100 },
      { orderId: "1", orderLabel: "A-1 · Tür", label: "Material", netAmount: 50 },
      { orderId: "2", orderLabel: "A-2 · Fenster", label: "Leistung", netAmount: 200 },
    ]);
    assert.equal(groups.length, 2);
    assert.equal(groups[0].subtotalNet, 150);
    assert.equal(groups[1].subtotalNet, 200);
  });
});
