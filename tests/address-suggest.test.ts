import { describe, it } from "node:test";
import assert from "node:assert/strict";

/** Spiegel der Formatierungslogik für Vorschlagslabels (ohne Netzwerk). */
function buildStreetLine(street: string, houseNumber: string | null): string {
  const s = street.trim();
  const h = houseNumber?.trim();
  if (!s) return h ?? "";
  if (!h) return s;
  return `${s} ${h}`;
}

function formatLabel(parts: { streetLine: string; zipCode: string; city: string }): string {
  const line1 = parts.streetLine || "Adresse";
  const line2 = [parts.zipCode, parts.city].filter(Boolean).join(" ");
  if (line2) return `${line1}, ${line2}`;
  return line1;
}

function dedupeKey(streetLine: string, zipCode: string, city: string) {
  return `${streetLine}|${zipCode}|${city}`.toLowerCase();
}

describe("address suggest formatting", () => {
  it("baut Straße mit Hausnummer", () => {
    assert.equal(buildStreetLine("Hauptstraße", "12"), "Hauptstraße 12");
    assert.equal(buildStreetLine("Hauptstraße", null), "Hauptstraße");
  });

  it("zeigt PLZ und Ort in Vorschlägen zur Unterscheidung", () => {
    const a = formatLabel({
      streetLine: "Hauptstraße 12",
      zipCode: "10115",
      city: "Berlin",
    });
    const b = formatLabel({
      streetLine: "Hauptstraße 12",
      zipCode: "10827",
      city: "Berlin",
    });
    assert.equal(a, "Hauptstraße 12, 10115 Berlin");
    assert.equal(b, "Hauptstraße 12, 10827 Berlin");
    assert.notEqual(a, b);
  });

  it("dedupliziert gleiche Adressen", () => {
    const keys = new Set([
      dedupeKey("Hauptstraße 12", "10115", "Berlin"),
      dedupeKey("hauptstraße 12", "10115", "Berlin"),
      dedupeKey("Hauptstraße 12", "10827", "Berlin"),
    ]);
    assert.equal(keys.size, 2);
  });
});
