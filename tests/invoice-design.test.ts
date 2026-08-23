import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_INVOICE_ACCENT,
  hexToRgb,
  lightenHex,
  normalizeHexColor,
  overlayCompanyPresentation,
  parseInvoiceLayout,
  resolveInvoiceDesign,
} from "../src/lib/documents/invoice-design";
import { buildCustomerDocumentHtml, type DocumentCalcInput } from "../src/lib/documents/build-document-html";
import {
  buildDocumentSnapshot,
  snapshotWithCurrentCompany,
} from "../src/lib/documents/snapshot";

const sampleCalc: DocumentCalcInput = {
  title: "Testleistung",
  netSalesPrice: 100,
  vatAmount: 19,
  grossSalesPrice: 119,
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
  laborItems: [{ description: "Arbeit", totalNet: 100, isVisibleToCustomer: true }],
  materialItems: [],
  travelCost: null,
  customer: { firstName: "Max", lastName: "Mustermann" },
};

describe("invoice design", () => {
  it("normalizes short and long hex colors", () => {
    assert.equal(normalizeHexColor("#0d5"), "#00dd55");
    assert.equal(normalizeHexColor("0D5C63"), "#0d5c63");
    assert.equal(normalizeHexColor("not-a-color"), DEFAULT_INVOICE_ACCENT);
  });

  it("converts hex to rgb", () => {
    assert.deepEqual(hexToRgb("#000000"), { r: 0, g: 0, b: 0 });
    assert.deepEqual(hexToRgb("#ffffff"), { r: 255, g: 255, b: 255 });
  });

  it("lightens accent for the header gradient", () => {
    const light = lightenHex("#000000", 0.5);
    assert.equal(light, "#808080");
  });

  it("falls back to default layout", () => {
    assert.equal(parseInvoiceLayout("LOGO_RIGHT"), "LOGO_RIGHT");
    assert.equal(parseInvoiceLayout("weird"), "LOGO_LEFT");
  });
});

describe("invoice html preview", () => {
  it("uses the chosen accent color and legal text", () => {
    const html = buildCustomerDocumentHtml(
      "INVOICE",
      sampleCalc,
      {
        companyName: "Testbetrieb",
        invoiceAccentColor: "#b45309",
        invoiceLayout: "LOGO_CENTER",
        invoiceLegalText: "Gerichtsstand Musterstadt",
        invoiceFooterText: "Fußzeile Test",
      },
      "RE-2026-0001",
      new Date("2026-08-01")
    );
    assert.match(html, /--accent:#b45309/);
    assert.match(html, /head logo-center/);
    assert.match(html, /Gerichtsstand Musterstadt/);
    assert.match(html, /Fußzeile Test/);
    assert.doesNotMatch(html, /print-bar/);
  });

  it("can include a back button for standalone view", () => {
    const html = buildCustomerDocumentHtml(
      "INVOICE",
      sampleCalc,
      { companyName: "Testbetrieb" },
      "RE-2026-0001",
      new Date("2026-08-01"),
      { includePrintChrome: true }
    );
    assert.match(html, /Zurück zur App/);
  });
});

describe("existing invoices stay frozen", () => {
  it("keeps amounts when overlaying current company settings", () => {
    const snapshot = buildDocumentSnapshot(
      "INVOICE",
      sampleCalc,
      {
        companyName: "Alt GmbH",
        invoiceAccentColor: "#0d5c63",
        invoiceFooterText: "Alte Fußzeile",
      },
      "RE-2026-0001",
      new Date("2026-01-15")
    );
    const overlaid = snapshotWithCurrentCompany(snapshot, {
      companyName: "Neu GmbH",
      invoiceAccentColor: "#b45309",
      invoiceFooterText: "Neue Fußzeile",
    });
    assert.equal(overlaid.amounts.gross, 119);
    assert.equal(overlaid.calc.netSalesPrice, 100);
    assert.equal(overlaid.documentNumber, "RE-2026-0001");
    assert.equal(overlaid.company.companyName, "Neu GmbH");
    assert.equal(overlaid.company.invoiceAccentColor, "#b45309");
    assert.equal(snapshot.company.companyName, "Alt GmbH");
  });

  it("overlay helper does not mutate original snapshot company by identity", () => {
    const original = {
      amounts: { net: 10, vat: 0, gross: 10 },
      calc: { netSalesPrice: 10 },
      company: { companyName: "Alt" },
    };
    const next = overlayCompanyPresentation(original, { companyName: "Neu" });
    assert.equal(original.company.companyName, "Alt");
    assert.equal(next.company.companyName, "Neu");
  });

  it("builds a PDF from a snapshot without throwing", async () => {
    const { buildDocumentPdf } = await import("../src/lib/documents/build-document-pdf");
    const snapshot = buildDocumentSnapshot(
      "INVOICE",
      sampleCalc,
      {
        companyName: "Testbetrieb",
        invoiceAccentColor: "#b45309",
        invoiceLayout: "LOGO_RIGHT",
        invoiceFooterText: "Fußzeile",
        invoiceLegalText: "AGB gelten",
        bankName: "Musterbank",
        iban: "DE00",
        paymentTermsDays: 14,
      },
      "RE-2026-0001",
      new Date("2026-08-01")
    );
    const bytes = await buildDocumentPdf(snapshot);
    assert.ok(bytes.byteLength > 100);
    assert.equal(String.fromCharCode(...bytes.slice(0, 4)), "%PDF");
  });

  it("resolveInvoiceDesign fills defaults for old snapshots without design fields", () => {
    const design = resolveInvoiceDesign({});
    assert.equal(design.invoiceAccentColor, DEFAULT_INVOICE_ACCENT);
    assert.equal(design.invoiceLayout, "LOGO_LEFT");
    assert.equal(design.invoiceTemplate, "STANDARD");
  });
});
