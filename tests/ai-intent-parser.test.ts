import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseIntent, parseDateFromText, parseDateRangeFromText } from "../src/lib/ai/intent-parser";

describe("parseIntent", () => {
  const ref = new Date("2026-07-13T12:00:00");

  it("detects person lookup", () => {
    const intent = parseIntent("Zeig mir Anton.", ref);
    assert.equal(intent.type, "person_lookup");
    assert.equal(intent.personName, "Anton");
  });

  it("detects list all employees", () => {
    assert.equal(parseIntent("Zeig mir alle Mitarbeiter", ref).type, "list_employees");
    assert.equal(parseIntent("alle Mitarbeiter nennen", ref).type, "list_employees");
    assert.equal(parseIntent("Liste alle Mitarbeiter", ref).type, "list_employees");
  });

  it("detects list all customers", () => {
    assert.equal(parseIntent("Zeig mir alle Kunden", ref).type, "list_customers");
    assert.equal(parseIntent("Kunden auflisten", ref).type, "list_customers");
  });

  it("does not treat list phrases as person names", () => {
    const intent = parseIntent("Zeig mir alle Mitarbeiter", ref);
    assert.equal(intent.type, "list_employees");
    assert.equal(intent.personName, undefined);
  });

  it("detects employee orders with date", () => {
    const intent = parseIntent("Welche Aufträge hat Anton am 26. Juli?", ref);
    assert.equal(intent.type, "employee_orders");
    assert.ok(intent.personName?.toLowerCase().includes("anton"));
    assert.ok(intent.date);
  });

  it("detects employee materials", () => {
    const intent = parseIntent("Was muss Anton am 26. Juli mitnehmen?", ref);
    assert.equal(intent.type, "employee_materials");
  });

  it("detects order search", () => {
    const intent = parseIntent("Zeig mir alle Aufträge mit Tür anbringen", ref);
    assert.equal(intent.type, "order_search");
    assert.ok(intent.searchTerm?.toLowerCase().includes("tür"));
  });

  it("detects open invoices", () => {
    const intent = parseIntent("Welche Kunden haben offene Rechnungen?", ref);
    assert.equal(intent.type, "open_invoices");
  });

  it("detects missing receipts", () => {
    const intent = parseIntent("Welche Belege fehlen diesen Monat?", ref);
    assert.equal(intent.type, "missing_receipts");
  });

  it("detects profit analysis", () => {
    const intent = parseIntent("Warum ist der Gewinn diesen Monat so hoch?", ref);
    assert.equal(intent.type, "profit_analysis");
  });

  it("detects material shortage", () => {
    const intent = parseIntent("Welche Materialien fehlen für die nächste Woche?", ref);
    assert.equal(intent.type, "material_shortage");
  });

  it("detects machine usage", () => {
    const intent = parseIntent("Welche Maschinen sind lange im Einsatz?", ref);
    assert.equal(intent.type, "machine_usage");
  });

  it("detects team schedule", () => {
    const intent = parseIntent("Welche Termine hat Team 1 morgen?", ref);
    assert.equal(intent.type, "team_schedule");
    assert.equal(intent.teamName, "1");
  });

  it("detects help", () => {
    const intent = parseIntent("Hilfe", ref);
    assert.equal(intent.type, "help");
  });
});

describe("parseDateFromText", () => {
  const ref = new Date("2026-07-13T12:00:00");

  it("parses morgen", () => {
    const d = parseDateFromText("morgen", ref);
    assert.ok(d);
    assert.equal(d.getDate(), 14);
  });

  it("parses 26. juli", () => {
    const d = parseDateFromText("26. juli", ref);
    assert.ok(d);
    assert.equal(d.getDate(), 26);
    assert.equal(d.getMonth(), 6);
  });
});

describe("parseDateRangeFromText", () => {
  const ref = new Date("2026-07-13T12:00:00");

  it("parses nächste woche", () => {
    const range = parseDateRangeFromText("nächste woche", ref);
    assert.ok(range);
    assert.ok(range.from < range.to);
  });
});
