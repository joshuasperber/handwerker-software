import { PDFDocument } from "pdf-lib";
import { buildDocumentPdf } from "../build-document-pdf";
import type { DocumentSnapshot } from "../snapshot";
import { buildXRechnungUblXml } from "./build-ubl-xml";

/**
 * Erzeugt eine hybride PDF mit eingebetteter XRechnung-XML.
 *
 * Profil: Factur-X / ZUGFeRD „XRechnung“ (Dateiname xrechnung.xml).
 * Hinweis: Die visuelle PDF bleibt pdf-lib-Standard (kein vollständiges PDF/A-3).
 * Für den produktiven Behördenversand sollte die Datei zusätzlich extern geprüft werden.
 */
export async function buildZugferdHybridPdf(snapshot: DocumentSnapshot): Promise<Uint8Array> {
  const visualPdf = await buildDocumentPdf(snapshot);
  const pdf = await PDFDocument.load(visualPdf);

  const xml = buildXRechnungUblXml(snapshot);
  const xmlBytes = new TextEncoder().encode(xml);

  await pdf.attach(xmlBytes, "xrechnung.xml", {
    mimeType: "text/xml",
    description: "Embedded XRechnung (EN 16931 / UBL) for ZUGFeRD XRechnung profile",
    creationDate: new Date(snapshot.issueDateISO),
    modificationDate: new Date(),
  });

  pdf.setTitle(`${snapshot.documentNumber} E-Rechnung`);
  pdf.setSubject("ZUGFeRD/Factur-X hybrid invoice (XRechnung profile)");
  pdf.setKeywords(["ZUGFeRD", "Factur-X", "XRechnung", "EN16931", "E-Rechnung"]);
  pdf.setProducer("JoMaster E-Rechnung");
  pdf.setCreator("JoMaster");

  return pdf.save();
}
