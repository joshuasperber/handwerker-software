import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateProjectInput } from "../src/lib/projects/types";

describe("project validation", () => {
  it("requires name and customer", () => {
    assert.equal(validateProjectInput({ name: "", customerId: "c1" }), "Projektname ist Pflicht.");
    assert.equal(validateProjectInput({ name: "Haus", customerId: "" }), "Kunde ist Pflicht.");
  });

  it("rejects end before start", () => {
    assert.equal(
      validateProjectInput({
        name: "Haus",
        customerId: "c1",
        startDate: "2026-07-10",
        endDate: "2026-07-01",
      }),
      "Enddatum darf nicht vor dem Startdatum liegen."
    );
  });

  it("accepts valid project", () => {
    assert.equal(
      validateProjectInput({
        name: "Projekt Hausbau Friedrichstraße",
        customerId: "c1",
        startDate: "2026-07-01",
        endDate: "2026-12-31",
      }),
      null
    );
  });
});
