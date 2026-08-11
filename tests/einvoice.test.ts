import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { DocumentSnapshot } from "../src/lib/documents/snapshot";
import {
  buildXRechnungUblXml,
  resolveEInvoiceFormat,
  validateForEInvoice,
} from "../src/lib/documents/einvoice";

function baseSnapshot(overrides: Partial<DocumentSnapshot> = {}): DocumentSnapshot {
  const base: DocumentSnapshot = {
    version: 1,
    type: "INVOICE",
    documentNumber: "RE-2026-0001",
    issueDateISO: "2026-07-01T10:00:00.000Z",
    amounts: { net: 100, vat: 19, gross: 119 },
    calc: {
      title: "Test",
      netSalesPrice: 100,
      vatAmount: 19,
      grossSalesPrice: 119,
      taxTreatment: "STANDARD_VAT",
      laborTotal: 100,
      materialTotal: 0,
      machineTotal: 0,
      procurementTotal: 0,
      travelTotal: 0,
      additionalTotal: 0,
      directCosts: 100,
      overheadAmount: 0,
      riskAmount: 0,
      profitAmount: 0,
      laborItems: [
        {
          description: "Montage",
          hours: 2,
          totalNet: 100,
          isVisibleToCustomer: true,
        },
      ],
      materialItems: [],
      travelCost: null,
      additionalItems: [],
      customer: {
        firstName: "Max",
        lastName: "Muster",
        company: "Muster GmbH",
        customerType: "BUSINESS",
        vatId: "DE123456789",
        email: "max@example.com",
        billingStreet: "Rechnungsweg 1",
        billingZipCode: "10115",
        billingCity: "Berlin",
      },
      order: {
        orderNumber: "A-100",
        property: { street: "Baustelle 2", zipCode: "10115", city: "Berlin" },
      },
    },
    company: {
      companyName: "Handwerk Test GmbH",
      street: "Werkstr.",
      houseNumber: "3",
      postalCode: "80331",
      city: "München",
      email: "buero@handwerk.test",
      phone: "+498912345",
      iban: "DE89370400440532013000",
      bic: "COBADEFFXXX",
      bankName: "Commerzbank",
      taxNumber: "143/123/12345",
      vatId: "DE987654321",
      paymentTermsDays: 14,
    },
  };
  return {
    ...base,
    ...overrides,
    calc: { ...base.calc, ...(overrides.calc ?? {}) },
    company: { ...base.company, ...(overrides.company ?? {}) },
    amounts: { ...base.amounts, ...(overrides.amounts ?? {}) },
  };
}

describe("e-invoice validation", () => {
  it("accepts a complete invoice snapshot", () => {
    const result = validateForEInvoice(baseSnapshot());
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
    assert.equal(result.preview.buyerName, "Muster GmbH");
    assert.match(result.preview.buyerAddress, /Rechnungsweg/);
  });

  it("blocks missing seller IBAN and buyer address", () => {
    const result = validateForEInvoice(
      baseSnapshot({
        company: {
          companyName: "X",
          street: "A",
          postalCode: "1",
          city: "Y",
          iban: null,
          taxNumber: "1",
        },
        calc: {
          ...baseSnapshot().calc,
          customer: {
            firstName: "A",
            lastName: "B",
            billingStreet: null,
            billingZipCode: null,
            billingCity: null,
          },
          order: { orderNumber: "A", property: null },
        },
      })
    );
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => /IBAN/i.test(e)));
    assert.ok(result.errors.some((e) => /Rechnungsadresse/i.test(e)));
  });

  it("rejects offers", () => {
    const result = validateForEInvoice(baseSnapshot({ type: "OFFER" }));
    assert.equal(result.valid, false);
  });
});

describe("e-invoice XML", () => {
  it("builds XRechnung UBL with buyer billing address and IBAN", () => {
    const xml = buildXRechnungUblXml(baseSnapshot());
    assert.match(xml, /CustomizationID/);
    assert.match(xml, /xrechnung_3\.0/);
    assert.match(xml, /Rechnungsweg 1/);
    assert.match(xml, /DE89370400440532013000/);
    assert.match(xml, /Muster GmbH/);
    assert.match(xml, /<cbc:InvoiceTypeCode>380<\/cbc:InvoiceTypeCode>/);
  });

  it("uses AE tax category for reverse charge", () => {
    const xml = buildXRechnungUblXml(
      baseSnapshot({
        amounts: { net: 100, vat: 0, gross: 100 },
        calc: {
          ...baseSnapshot().calc,
          netSalesPrice: 100,
          vatAmount: 0,
          grossSalesPrice: 100,
          taxTreatment: "REVERSE_CHARGE",
          isReverseCharge: true,
        },
      })
    );
    assert.match(xml, /<cbc:ID>AE<\/cbc:ID>/);
  });
});

describe("e-invoice format helpers", () => {
  it("resolves format ids", () => {
    assert.equal(resolveEInvoiceFormat("zugferd"), "ZUGFERD_PDF");
    assert.equal(resolveEInvoiceFormat("xrechnung"), "XRECHNUNG_UBL");
  });
});
