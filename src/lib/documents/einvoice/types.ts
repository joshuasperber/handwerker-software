/** Unterstützte E-Rechnungsformate (erste Stufe). */
export type EInvoiceFormatId = "XRECHNUNG_UBL" | "ZUGFERD_PDF";

export const E_INVOICE_FORMATS: {
  id: EInvoiceFormatId;
  label: string;
  description: string;
  mimeType: string;
  fileExtension: string;
  /** Persistierter Format-String auf CalculationDocument.eInvoiceFormat */
  storageLabel: string;
}[] = [
  {
    id: "XRECHNUNG_UBL",
    label: "XRechnung (XML)",
    description:
      "Strukturierte UBL-XML nach EN 16931 / XRechnung-Profil. Separat herunterladen.",
    mimeType: "application/xml",
    fileExtension: "xml",
    storageLabel: "XRechnung-UBL-3.0",
  },
  {
    id: "ZUGFERD_PDF",
    label: "ZUGFeRD / Factur-X (PDF+XML)",
    description:
      "Visuelle PDF-Rechnung mit eingebetteter XRechnung-XML (Profil XRechnung). Kein automatischer E-Mail-Versand.",
    mimeType: "application/pdf",
    fileExtension: "pdf",
    storageLabel: "ZUGFeRD-2.3-XRechnung",
  },
];

export function resolveEInvoiceFormat(raw: string | null | undefined): EInvoiceFormatId {
  if (raw === "ZUGFERD_PDF" || raw === "zugferd" || raw === "ZUGFeRD") return "ZUGFERD_PDF";
  return "XRECHNUNG_UBL";
}

export function formatMeta(id: EInvoiceFormatId) {
  return E_INVOICE_FORMATS.find((f) => f.id === id) ?? E_INVOICE_FORMATS[0];
}

export type EInvoiceIssue = {
  code: string;
  message: string;
  /** error = blockiert Erzeugung; warning = erlaubt mit Hinweis */
  severity: "error" | "warning";
};

export type EInvoiceReadiness = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  issues: EInvoiceIssue[];
  preview: {
    documentNumber: string;
    issueDate: string;
    dueDate: string | null;
    buyerName: string;
    buyerAddress: string;
    sellerName: string;
    net: number;
    vat: number;
    gross: number;
    lineCount: number;
    taxTreatment: string;
    serviceDateNote: string;
  };
};
