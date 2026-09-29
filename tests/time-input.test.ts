import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeTimeInput, sanitizeTimeInput } from "../src/components/ui/date-input";

describe("time input", () => {
  it("normalisiert frei eingegebene Uhrzeiten", () => {
    assert.equal(normalizeTimeInput("9:30"), "09:30");
    assert.equal(normalizeTimeInput("930"), "09:30");
    assert.equal(normalizeTimeInput("1745"), "17:45");
  });

  it("weist ungültige Uhrzeiten zurück", () => {
    assert.equal(normalizeTimeInput("24:00"), null);
    assert.equal(normalizeTimeInput("12:75"), null);
    assert.equal(normalizeTimeInput("Zeit"), null);
  });

  it("formatiert vier Ziffern während der Eingabe", () => {
    assert.equal(sanitizeTimeInput("930"), "930");
    assert.equal(sanitizeTimeInput("0930"), "09:30");
    assert.equal(sanitizeTimeInput("12:4a"), "12:4");
  });
});
