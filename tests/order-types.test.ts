import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatOrderTypeLabel } from "../src/lib/orders/order-type-label";

describe("formatOrderTypeLabel", () => {
  it("preferiert Freitext bei Sonstiges", () => {
    assert.equal(
      formatOrderTypeLabel({
        orderTypeLabel: "Sonstiges",
        orderTypeCustom: "Spezialmontage",
        orderTypeDefinition: { name: "Sonstiges", isOther: true },
      }),
      "Spezialmontage"
    );
  });

  it("nutzt Snapshot-Label vor Katalog-Umbenennung", () => {
    assert.equal(
      formatOrderTypeLabel({
        orderTypeLabel: "Reparatur",
        orderTypeDefinition: { name: "Reparaturarbeiten", isOther: false },
      }),
      "Reparatur"
    );
  });

  it("fällt auf Legacy-Enum zurück", () => {
    assert.equal(formatOrderTypeLabel({ orderType: "MONTAGE" }), "Montage");
  });
});
