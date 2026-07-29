import type { DocumentStatus } from "@/generated/prisma/client";

export type InvoiceActionMode = "update" | "create" | "correction";

export interface InvoiceDocLike {
  id: string;
  documentNumber: string;
  status: DocumentStatus | string;
  sentAt?: Date | string | null;
  paidAmount?: number | null;
  canceledAt?: Date | string | null;
  cancelOfId?: string | null;
  documentType?: string;
}

/** Aktive Kundenrechnung (kein Storno-Beleg, nicht storniert). */
export function isActiveInvoice(doc: InvoiceDocLike): boolean {
  if (doc.documentType && doc.documentType !== "INVOICE") return false;
  if (doc.cancelOfId) return false;
  if (doc.status === "STORNIERT" || doc.canceledAt) return false;
  return true;
}

/**
 * Bearbeitbar: Entwurf, oder noch nicht versendete/unbezahlte offene Rechnung.
 * Finalisiert/versendet/bezahlt/teilbezahlt → nicht still überschreiben.
 */
export function isInvoiceEditable(doc: InvoiceDocLike): boolean {
  if (!isActiveInvoice(doc)) return false;
  if (doc.status === "ENTWURF") return true;
  if (doc.status === "TEILBEZAHLT" || doc.status === "BEZAHLT") return false;
  if (doc.status === "OFFEN") {
    const paid = Number(doc.paidAmount ?? 0);
    if (paid > 0.001) return false;
    if (doc.sentAt) return false;
    return true;
  }
  return false;
}

export function invoiceEditBlockReason(doc: InvoiceDocLike): string | null {
  if (!isActiveInvoice(doc)) return "Die Rechnung ist nicht mehr aktiv.";
  if (isInvoiceEditable(doc)) return null;
  if (doc.status === "BEZAHLT") return "Die Rechnung ist bereits bezahlt.";
  if (doc.status === "TEILBEZAHLT") return "Die Rechnung ist teilweise bezahlt.";
  if (doc.sentAt) return "Die Rechnung wurde bereits versendet.";
  return "Die Rechnung ist finalisiert und darf nicht still überschrieben werden.";
}

/**
 * Rechnungsdatum darf geändert werden, außer bei Storno.
 * Bei finalisierten/versendeten/bezahlten Rechnungen braucht es eine Bestätigung.
 */
export function canChangeInvoiceIssueDate(doc: InvoiceDocLike): boolean {
  return isActiveInvoice(doc);
}

/** true = Nutzer muss die Auswirkungen bestätigen. */
export function issueDateChangeNeedsConfirmation(doc: InvoiceDocLike): boolean {
  if (!canChangeInvoiceIssueDate(doc)) return false;
  if (doc.status === "ENTWURF") return false;
  if (isInvoiceEditable(doc)) return false;
  return true;
}

export const ISSUE_DATE_CHANGE_WARNING =
  "Diese Rechnung wurde bereits finalisiert, versendet oder bezahlt. Das Ändern des Rechnungsdatums kann Auswirkungen auf Umsatzübersichten und Buchhaltung haben. Möchtest du fortfahren?";

export const INVOICE_EXISTS_MESSAGE =
  "Für diesen Auftrag existiert bereits eine Rechnung. Möchtest du die bestehende Rechnung bearbeiten oder bewusst eine neue Rechnung/Korrekturrechnung erstellen?";
