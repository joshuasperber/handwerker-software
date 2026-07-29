import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatIssueDateInput,
  parseIssueDateInput,
  shiftDueDateForIssueChange,
} from "../src/lib/documents/issue-date";
import {
  issueDateChangeNeedsConfirmation,
  canChangeInvoiceIssueDate,
} from "../src/lib/documents/invoice-lifecycle";

describe("issue-date helpers", () => {
  it("parses YYYY-MM-DD as local calendar day", () => {
    const d = parseIssueDateInput("2026-07-31");
    assert.ok(d);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 6);
    assert.equal(d.getDate(), 31);
  });

  it("rejects invalid dates", () => {
    assert.equal(parseIssueDateInput("2026-02-31"), null);
    assert.equal(parseIssueDateInput(""), null);
    assert.equal(parseIssueDateInput(null), null);
  });

  it("shifts due date with issue date delta", () => {
    const oldIssue = parseIssueDateInput("2026-08-03")!;
    const newIssue = parseIssueDateInput("2026-07-31")!;
    const due = parseIssueDateInput("2026-08-17")!;
    const next = shiftDueDateForIssueChange(oldIssue, newIssue, due)!;
    assert.equal(formatIssueDateInput(next), "2026-08-14");
  });
});

describe("issue date change confirmation", () => {
  it("allows drafts without confirmation", () => {
    assert.equal(
      issueDateChangeNeedsConfirmation({
        id: "1",
        documentNumber: "RE-1",
        status: "ENTWURF",
      }),
      false
    );
  });

  it("requires confirmation when sent or paid", () => {
    assert.equal(
      issueDateChangeNeedsConfirmation({
        id: "1",
        documentNumber: "RE-1",
        status: "OFFEN",
        sentAt: new Date().toISOString(),
      }),
      true
    );
    assert.equal(
      issueDateChangeNeedsConfirmation({
        id: "1",
        documentNumber: "RE-1",
        status: "BEZAHLT",
      }),
      true
    );
  });

  it("blocks cancelled invoices", () => {
    assert.equal(
      canChangeInvoiceIssueDate({
        id: "1",
        documentNumber: "RE-1",
        status: "STORNIERT",
      }),
      false
    );
  });
});
