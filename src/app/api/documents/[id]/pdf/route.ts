import { prisma } from "@/lib/prisma";
import { requireAuth, apiError } from "@/lib/api";
import { buildDocumentPdf } from "@/lib/documents/build-document-pdf";
import type { DocumentSnapshot } from "@/lib/documents/snapshot";
import { uploadFile, isStorageConfigured } from "@/lib/storage";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("invoices.read");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const doc = await prisma.calculationDocument.findFirst({
    where: { id, calculation: { tenantId: auth.tenantId } },
  });
  if (!doc) return apiError("Dokument nicht gefunden", 404);

  const snapshot = doc.dataSnapshotJson as unknown as DocumentSnapshot | null;
  if (!snapshot) return apiError("Kein Snapshot vorhanden – PDF nicht möglich", 400);

  const bytes = await buildDocumentPdf(snapshot);

  // PDF einmalig in S3 ablegen (best effort), wenn noch nicht geschehen.
  if (!doc.pdfStorageKey && isStorageConfigured()) {
    try {
      const { key } = await uploadFile(
        Buffer.from(bytes),
        `${doc.documentNumber}.pdf`,
        "application/pdf",
        "documents"
      );
      await prisma.calculationDocument.update({
        where: { id: doc.id },
        data: { pdfStorageKey: key },
      });
    } catch {
      // Speicherung optional – Download funktioniert trotzdem.
    }
  }

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.documentNumber}.pdf"`,
    },
  });
}
