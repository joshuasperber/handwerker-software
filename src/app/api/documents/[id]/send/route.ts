import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError, getClientIp } from "@/lib/api";
import { buildDocumentPdf } from "@/lib/documents/build-document-pdf";
import type { DocumentSnapshot } from "@/lib/documents/snapshot";
import { sendNotification } from "@/lib/notifications";
import { createAuditLog } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("invoices.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const doc = await prisma.calculationDocument.findFirst({
    where: { id, calculation: { tenantId: auth.tenantId } },
    include: { calculation: { include: { customer: true } } },
  });
  if (!doc) return apiError("Dokument nicht gefunden", 404);
  if (doc.status === "STORNIERT") return apiError("Stornierte Belege können nicht versendet werden", 400);

  const snapshot = doc.dataSnapshotJson as unknown as DocumentSnapshot | null;
  if (!snapshot) return apiError("Kein Snapshot vorhanden", 400);

  const email =
    snapshot.calc.customer?.email || doc.calculation.customer?.email || null;
  if (!email) return apiError("Keine E-Mail-Adresse des Kunden hinterlegt", 400);

  const pdf = await buildDocumentPdf(snapshot);
  const isInvoice = doc.documentType === "INVOICE";
  const docLabel = isInvoice ? "Rechnung" : "Angebot";
  const company = snapshot.company.companyName;

  const sent = await sendNotification({
    tenantId: auth.tenantId,
    type: isInvoice ? "RECHNUNG" : "NACHRICHT",
    channel: "EMAIL",
    recipient: email,
    subject: `${docLabel} ${doc.documentNumber} von ${company}`,
    body:
      `Guten Tag,\n\nim Anhang erhalten Sie ${
        isInvoice ? "Ihre Rechnung" : "Ihr Angebot"
      } ${doc.documentNumber}.\n\n` +
      (company ? `Mit freundlichen Grüßen\n${company}` : "Mit freundlichen Grüßen"),
    metadata: { documentId: doc.id, documentNumber: doc.documentNumber },
    attachments: [
      { filename: `${doc.documentNumber}.pdf`, content: Buffer.from(pdf), contentType: "application/pdf" },
    ],
  });

  if (!sent) return apiError("Versand fehlgeschlagen – bitte E-Mail-Einstellungen prüfen", 502);

  await prisma.calculationDocument.update({
    where: { id: doc.id },
    data: { sentAt: new Date() },
  });

  await createAuditLog({
    tenantId: auth.tenantId,
    userId: auth.id,
    entityType: "CalculationDocument",
    entityId: doc.id,
    action: "DOCUMENT_SENT",
    newValues: { recipient: email, documentNumber: doc.documentNumber },
    ipAddress: getClientIp(request),
  });

  return apiSuccess({ sentAt: new Date().toISOString(), recipient: email });
}
