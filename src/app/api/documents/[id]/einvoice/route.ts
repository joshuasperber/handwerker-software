import { prisma } from "@/lib/prisma";
import { requireAuth, apiError } from "@/lib/api";
import type { DocumentSnapshot } from "@/lib/documents/snapshot";
import { buildEInvoiceXml, validateForEInvoice } from "@/lib/documents/build-einvoice-xml";

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
  if (!snapshot) return apiError("Kein Snapshot vorhanden", 400);

  const validation = validateForEInvoice(snapshot);
  if (!validation.valid) {
    return apiError(`E-Rechnung nicht möglich: ${validation.errors.join("; ")}`, 400);
  }

  const xml = buildEInvoiceXml(snapshot);

  if (!doc.eInvoiceFormat) {
    await prisma.calculationDocument
      .update({ where: { id: doc.id }, data: { eInvoiceFormat: "XRechnung-UBL-3.0" } })
      .catch(() => {});
  }

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${doc.documentNumber}.xml"`,
    },
  });
}
