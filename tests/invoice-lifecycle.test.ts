import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isActiveInvoice,
  isInvoiceEditable,
  invoiceEditBlockReason,
} from "../src/lib/documents/invoice-lifecycle";

describe("invoice lifecycle", () => {
  it("treats unsent unpaid OFFEN as editable", () => {
    const doc = {
      id: "1",
      documentNumber: "RE-2026-001",
      status: "OFFEN",
      sentAt: null,
      paidAmount: 0,
      cancelOfId: null,
      documentType: "INVOICE",
    };
    assert.equal(isActiveInvoice(doc), true);
    assert.equal(isInvoiceEditable(doc), true);
    assert.equal(invoiceEditBlockReason(doc), null);
  });

  it("locks sent invoices", () => {
    const doc = {
      id: "1",
      documentNumber: "RE-2026-001",
      status: "OFFEN",
      sentAt: new Date(),
      paidAmount: 0,
      cancelOfId: null,
      documentType: "INVOICE",
    };
    assert.equal(isInvoiceEditable(doc), false);
    assert.match(invoiceEditBlockReason(doc) ?? "", /versendet/i);
  });

  it("locks paid invoices", () => {
    const doc = {
      id: "1",
      documentNumber: "RE-2026-001",
      status: "BEZAHLT",
      sentAt: null,
      paidAmount: 100,
      cancelOfId: null,
      documentType: "INVOICE",
    };
    assert.equal(isInvoiceEditable(doc), false);
    assert.match(invoiceEditBlockReason(doc) ?? "", /bezahlt/i);
  });

  it("ignores storno documents as active", () => {
    const storno = {
      id: "2",
      documentNumber: "RE-2026-002",
      status: "STORNIERT",
      cancelOfId: "1",
      documentType: "INVOICE",
    };
    assert.equal(isActiveInvoice(storno), false);
  });

  it("allows ENTWURF", () => {
    const doc = {
      id: "1",
      documentNumber: "RE-2026-001",
      status: "ENTWURF",
      sentAt: null,
      paidAmount: 0,
      cancelOfId: null,
      documentType: "INVOICE",
    };
    assert.equal(isInvoiceEditable(doc), true);
  });
});
