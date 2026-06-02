import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { buildCustomerDocumentHtml, buildInternalBreakdownHtml } from "@/lib/documents/build-document-html";
import { loadCalculationForDocument } from "@/lib/documents/load-calculation-document";

export async function POST(request: Request) {
  const auth = await requireAuth("calculations.write");
  if (auth instanceof Response) return auth;

  const { calculationId } = await request.json();
  const loaded = await loadCalculationForDocument(auth.tenantId, calculationId);
  if (!loaded) return apiError("Kalkulation nicht gefunden", 404);

  const docNumber = `ANG-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const html = buildCustomerDocumentHtml("OFFER", loaded.calc, loaded.company, docNumber);

  const doc = await prisma.calculationDocument.create({
    data: {
      calculationId,
      documentType: "OFFER",
      documentNumber: docNumber,
    },
  });

  await prisma.calculation.update({
    where: { id: calculationId },
    data: { status: "OFFER_CREATED" },
  });

  return apiSuccess({
    document: doc,
    html,
    breakdownHtml: buildInternalBreakdownHtml(loaded.calc, docNumber),
    message: "Angebot erstellt – Drucken über Browser möglich",
  });
}
