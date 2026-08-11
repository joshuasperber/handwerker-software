export {
  E_INVOICE_FORMATS,
  formatMeta,
  resolveEInvoiceFormat,
  type EInvoiceFormatId,
  type EInvoiceIssue,
  type EInvoiceReadiness,
} from "./types";
export {
  validateForEInvoice,
  buyerDisplayName,
  resolveBuyerAddress,
} from "./validate";
export { buildXRechnungUblXml } from "./build-ubl-xml";
export { buildZugferdHybridPdf } from "./build-hybrid-pdf";

import type { DocumentSnapshot } from "../snapshot";
import { buildXRechnungUblXml } from "./build-ubl-xml";
import { buildZugferdHybridPdf } from "./build-hybrid-pdf";
import { formatMeta, resolveEInvoiceFormat, type EInvoiceFormatId } from "./types";
import { validateForEInvoice } from "./validate";

/** Rückwärtskompatibel: bisheriger Name für UBL-XML. */
export function buildEInvoiceXml(snapshot: DocumentSnapshot): string {
  return buildXRechnungUblXml(snapshot);
}

export async function buildEInvoiceFile(
  snapshot: DocumentSnapshot,
  format: EInvoiceFormatId | string
): Promise<{
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
  storageLabel: string;
  formatId: EInvoiceFormatId;
}> {
  const readiness = validateForEInvoice(snapshot);
  if (!readiness.valid) {
    throw new Error(`E-Rechnung nicht möglich: ${readiness.errors.join("; ")}`);
  }

  const formatId = resolveEInvoiceFormat(String(format));
  const meta = formatMeta(formatId);
  const base = snapshot.documentNumber.replace(/[^\w.-]+/g, "_");

  if (formatId === "ZUGFERD_PDF") {
    const bytes = await buildZugferdHybridPdf(snapshot);
    return {
      bytes,
      mimeType: meta.mimeType,
      fileName: `${base}_zugferd.pdf`,
      storageLabel: meta.storageLabel,
      formatId,
    };
  }

  const xml = buildXRechnungUblXml(snapshot);
  return {
    bytes: new TextEncoder().encode(xml),
    mimeType: meta.mimeType,
    fileName: `${base}_xrechnung.xml`,
    storageLabel: meta.storageLabel,
    formatId,
  };
}
