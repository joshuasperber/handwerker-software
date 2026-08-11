/**
 * Kompatibilitäts-Export – Implementierung liegt unter ./einvoice/
 */
export {
  buildEInvoiceXml,
  buildXRechnungUblXml,
  validateForEInvoice,
  type EInvoiceReadiness,
} from "./einvoice";

/** @deprecated Nutze EInvoiceReadiness / issues */
export type EInvoiceValidation = {
  valid: boolean;
  errors: string[];
};
