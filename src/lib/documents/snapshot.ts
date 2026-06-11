import {
  buildCustomerDocumentHtml,
  type DocumentCalcInput,
  type DocumentCompanyInput,
} from "./build-document-html";
import type { CalculationDocumentType } from "@/generated/prisma/client";

/**
 * Unveränderlicher Datenstand einer Rechnung/eines Angebots zum Erstellzeitpunkt.
 * Wird als JSON in CalculationDocument.dataSnapshotJson gespeichert, damit ein
 * bereits erstelltes Dokument exakt gleich bleibt – auch wenn sich Stammdaten
 * oder die Kalkulation später ändern (GoBD-Unveränderlichkeit).
 */
export interface DocumentSnapshot {
  version: 1;
  type: CalculationDocumentType;
  documentNumber: string;
  issueDateISO: string;
  amounts: { net: number; vat: number; gross: number };
  calc: DocumentCalcInput;
  company: DocumentCompanyInput;
}

export function buildDocumentSnapshot(
  type: CalculationDocumentType,
  calc: DocumentCalcInput,
  company: DocumentCompanyInput,
  documentNumber: string,
  issueDate: Date
): DocumentSnapshot {
  return {
    version: 1,
    type,
    documentNumber,
    issueDateISO: issueDate.toISOString(),
    amounts: {
      net: calc.netSalesPrice,
      vat: calc.vatAmount,
      gross: calc.grossSalesPrice,
    },
    calc,
    company,
  };
}

/** Rendert das gespeicherte Dokument deterministisch aus dem Snapshot. */
export function renderSnapshotHtml(snapshot: DocumentSnapshot): string {
  const htmlType = snapshot.type === "INVOICE" ? "INVOICE" : "OFFER";
  return buildCustomerDocumentHtml(
    htmlType,
    snapshot.calc,
    snapshot.company,
    snapshot.documentNumber,
    new Date(snapshot.issueDateISO)
  );
}
