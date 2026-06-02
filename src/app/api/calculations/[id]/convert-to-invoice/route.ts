import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { buildCustomerDocumentHtml, buildInternalBreakdownHtml } from "@/lib/documents/build-document-html";
import { loadCalculationForDocument } from "@/lib/documents/load-calculation-document";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("calculations.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const previewOnly = body.preview === true;

  const loaded = await loadCalculationForDocument(auth.tenantId, id);
  if (!loaded) return apiError("Kalkulation nicht gefunden", 404);

  const count = await prisma.calculationDocument.count({
    where: { calculationId: id, documentType: "INVOICE" },
  });

  const docNumber = `RE-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
  const html = buildCustomerDocumentHtml("INVOICE", loaded.calc, loaded.company, docNumber);
  const breakdownHtml = buildInternalBreakdownHtml(loaded.calc, docNumber);

  if (previewOnly) {
    return apiSuccess({ html, breakdownHtml, documentNumber: docNumber });
  }

  const doc = await prisma.calculationDocument.create({
    data: {
      calculationId: id,
      documentType: "INVOICE",
      documentNumber: docNumber,
      internalNote: `Netto ${loaded.calc.netSalesPrice} · Brutto ${loaded.calc.grossSalesPrice}`,
    },
  });

  await prisma.calculation.update({
    where: { id },
    data: { status: "INVOICE_CREATED" },
  });

  if (loaded.orderId) {
    await prisma.order.update({
      where: { id: loaded.orderId },
      data: { status: "ABGERECHNET", invoicedAt: new Date() },
    });
  }

  return apiSuccess({
    document: doc,
    html,
    breakdownHtml,
    orderUpdated: !!loaded.orderId,
  }, 201);
}
