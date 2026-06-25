import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toDocumentListItem } from "../src/lib/documents/document-view";

const baseDoc = {
  id: "doc-1",
  documentNumber: "RE-2026-001",
  documentType: "INVOICE",
  status: "OFFEN",
  issueDate: new Date("2026-06-01T00:00:00.000Z"),
  dueDate: new Date("2026-06-10T00:00:00.000Z"),
  netAmount: 100,
  vatAmount: 19,
  grossAmount: 119,
  paidAmount: 0,
  sentAt: null,
  canceledAt: null,
  cancelOfId: null,
  pdfStorageKey: null,
  eInvoiceFormat: null,
  dataSnapshotJson: null,
  calculation: {
    id: "calc-1",
    title: "Test",
    orderId: "order-1",
    customer: { firstName: "Max", lastName: "Mustermann" },
  },
};

describe("toDocumentListItem overdue", () => {
  const now = new Date("2026-06-12T00:00:00.000Z");

  it("marks open invoice past due date as overdue", () => {
    const item = toDocumentListItem(baseDoc, now);
    assert.equal(item.overdue, true);
    assert.equal(item.openAmount, 119);
  });

  it("does not mark paid invoice as overdue", () => {
    const item = toDocumentListItem(
      { ...baseDoc, status: "BEZAHLT", paidAmount: 119 },
      now
    );
    assert.equal(item.overdue, false);
  });

  it("does not mark invoice without due date as overdue", () => {
    const item = toDocumentListItem({ ...baseDoc, dueDate: null }, now);
    assert.equal(item.overdue, false);
  });
});
