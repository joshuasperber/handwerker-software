import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calcVatWithTreatment,
  suggestTaxTreatmentForCustomer,
} from "../src/lib/tax/treatment";

describe("suggestTaxTreatmentForCustomer", () => {
  it("suggests reverse charge for business customers with VAT ID", () => {
    const suggestion = suggestTaxTreatmentForCustomer({
      customerType: "GEWERBLICH",
      company: "Muster GmbH",
      vatId: "DE123456789",
    });
    assert.equal(suggestion?.taxTreatment, "REVERSE_CHARGE");
    assert.equal(suggestion?.reverseCharge, true);
  });

  it("keeps standard VAT for business customers without VAT ID", () => {
    const suggestion = suggestTaxTreatmentForCustomer({
      customerType: "GEWERBLICH",
      company: "Muster GmbH",
      vatId: null,
    });
    assert.equal(suggestion?.taxTreatment, "STANDARD_VAT");
    assert.equal(suggestion?.reverseCharge, false);
  });

  it("keeps standard VAT for private customers", () => {
    const suggestion = suggestTaxTreatmentForCustomer({
      customerType: "PRIVAT",
      company: null,
      vatId: null,
    });
    assert.equal(suggestion?.taxTreatment, "STANDARD_VAT");
  });
});

describe("calcVatWithTreatment reverse charge", () => {
  it("zeros VAT for reverse charge", () => {
    const result = calcVatWithTreatment({
      netSalesPrice: 2000,
      vatRatePercent: 19,
      taxTreatment: "REVERSE_CHARGE",
    });
    assert.equal(result.vatAmount, 0);
    assert.equal(result.grossSalesPrice, 2000);
    assert.equal(result.isReverseCharge, true);
  });

  it("applies standard VAT otherwise", () => {
    const result = calcVatWithTreatment({
      netSalesPrice: 2000,
      vatRatePercent: 19,
      taxTreatment: "STANDARD_VAT",
    });
    assert.equal(result.vatAmount, 380);
    assert.equal(result.grossSalesPrice, 2380);
  });
});
