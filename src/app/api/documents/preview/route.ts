import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { buildCustomerDocumentHtml, buildInternalBreakdownHtml } from "@/lib/documents/build-document-html";
import { loadCalculationForDocument } from "@/lib/documents/load-calculation-document";

export async function POST(request: Request) {
  const auth = await requireAuth("calculations.read");
  if (auth instanceof Response) return auth;

  const { calculationId, type = "invoice" } = await request.json();
  if (!calculationId) return apiError("calculationId fehlt", 400);

  const loaded = await loadCalculationForDocument(auth.tenantId, calculationId);
  if (!loaded) return apiError("Kalkulation nicht gefunden", 404);

  const docNumber = type === "breakdown" ? "INTERN" : `VORSCHAU-${Date.now().toString().slice(-6)}`;
  const html =
    type === "breakdown"
      ? buildInternalBreakdownHtml(loaded.calc, docNumber)
      : buildCustomerDocumentHtml("INVOICE", loaded.calc, loaded.company, docNumber);

  return apiSuccess({ html, breakdownHtml: buildInternalBreakdownHtml(loaded.calc, docNumber) });
}
