import type { DocumentSnapshot } from "./snapshot";

export interface DocumentListItem {
  id: string;
  documentNumber: string;
  documentType: "OFFER" | "ORDER_CONFIRMATION" | "INVOICE";
  status: "ENTWURF" | "OFFEN" | "TEILBEZAHLT" | "BEZAHLT" | "STORNIERT";
  issueDate: string;
  dueDate: string | null;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  paidAmount: number;
  openAmount: number;
  overdue: boolean;
  customerName: string;
  title: string | null;
  calculationId: string;
  sentAt: string | null;
  canceledAt: string | null;
  cancelOfId: string | null;
  hasPdf: boolean;
  eInvoiceFormat: string | null;
}

interface RawDoc {
  id: string;
  documentNumber: string;
  documentType: string;
  status: string;
  issueDate: Date;
  dueDate: Date | null;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  paidAmount: number;
  sentAt: Date | null;
  canceledAt: Date | null;
  cancelOfId: string | null;
  pdfStorageKey: string | null;
  eInvoiceFormat: string | null;
  dataSnapshotJson: unknown;
  calculation: {
    id: string;
    title: string | null;
    customer: { firstName: string; lastName: string } | null;
  };
}

function customerNameFromSnapshot(snap: unknown): string | null {
  const s = snap as DocumentSnapshot | null;
  const c = s?.calc?.customer;
  if (!c) return null;
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || null;
}

export function toDocumentListItem(doc: RawDoc, now = new Date()): DocumentListItem {
  const openAmount = Math.max(0, doc.grossAmount - doc.paidAmount);
  const isInvoice = doc.documentType === "INVOICE";
  const overdue =
    isInvoice &&
    (doc.status === "OFFEN" || doc.status === "TEILBEZAHLT") &&
    doc.dueDate != null &&
    doc.dueDate.getTime() < now.getTime();

  const customerName =
    customerNameFromSnapshot(doc.dataSnapshotJson) ??
    (doc.calculation.customer
      ? [doc.calculation.customer.firstName, doc.calculation.customer.lastName]
          .filter(Boolean)
          .join(" ")
      : "—");

  return {
    id: doc.id,
    documentNumber: doc.documentNumber,
    documentType: doc.documentType as DocumentListItem["documentType"],
    status: doc.status as DocumentListItem["status"],
    issueDate: doc.issueDate.toISOString(),
    dueDate: doc.dueDate?.toISOString() ?? null,
    netAmount: doc.netAmount,
    vatAmount: doc.vatAmount,
    grossAmount: doc.grossAmount,
    paidAmount: doc.paidAmount,
    openAmount,
    overdue,
    customerName,
    title: doc.calculation.title,
    calculationId: doc.calculation.id,
    sentAt: doc.sentAt?.toISOString() ?? null,
    canceledAt: doc.canceledAt?.toISOString() ?? null,
    cancelOfId: doc.cancelOfId,
    hasPdf: !!doc.pdfStorageKey,
    eInvoiceFormat: doc.eInvoiceFormat,
  };
}

/** Status aus Zahlbetrag ableiten (für Rechnungen). */
export function deriveInvoiceStatus(
  grossAmount: number,
  paidAmount: number
): "OFFEN" | "TEILBEZAHLT" | "BEZAHLT" {
  if (paidAmount <= 0) return "OFFEN";
  if (paidAmount + 0.005 >= grossAmount) return "BEZAHLT";
  return "TEILBEZAHLT";
}
