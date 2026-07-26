import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { areOrderChecklistsComplete } from "../src/lib/orders/checklist";
import { isMonteurAppointmentStatus } from "../src/lib/scheduling/monteur-status";

describe("areOrderChecklistsComplete", () => {
  it("ignores checklist items without label", () => {
    assert.equal(
      areOrderChecklistsComplete([
        { label: "", isChecked: false },
        { label: "Montage", isChecked: true },
      ]),
      true
    );
  });

  it("requires labeled items to be checked", () => {
    assert.equal(
      areOrderChecklistsComplete([
        { label: "Montage", isChecked: false },
        { label: "Abnahme", isChecked: true },
      ]),
      false
    );
  });
});

describe("isMonteurAppointmentStatus", () => {
  it("allows field workflow statuses", () => {
    assert.equal(isMonteurAppointmentStatus("IN_ARBEIT"), true);
    assert.equal(isMonteurAppointmentStatus("ABGESCHLOSSEN"), true);
  });

  it("rejects office-only statuses", () => {
    assert.equal(isMonteurAppointmentStatus("STORNIERT"), false);
    assert.equal(isMonteurAppointmentStatus("GEPLANT"), false);
  });
});
