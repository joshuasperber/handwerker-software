import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { getReorderSuggestions } from "@/lib/inventory/reorder";

export async function GET() {
  try {
    const auth = await requireAuth("inventory.read");
    if (auth instanceof Response) return auth;

    const suggestions = await getReorderSuggestions(auth.tenantId);
    return apiSuccess({ suggestions, count: suggestions.length });
  } catch (err) {
    console.error("[GET /api/reorder-suggestions]", err);
    return apiError("Bestellvorschläge konnten nicht geladen werden", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth("inventory.write");
    if (auth instanceof Response) return auth;

    const body = await request.json();
    if (!body.articleId || !body.quantity || body.quantity <= 0) {
      return apiError("Artikel und Menge (> 0) erforderlich", 400);
    }

    const article = await prisma.article.findFirst({
      where: { id: body.articleId, tenantId: auth.tenantId, isActive: true },
    });
    if (!article) return apiError("Artikel nicht gefunden", 404);

    const suggestion = await prisma.manualReorderSuggestion.create({
      data: {
        tenantId: auth.tenantId,
        articleId: body.articleId,
        quantity: Number(body.quantity),
        supplierName: body.supplierName ?? article.supplierName,
        note: body.note,
        createdById: auth.id,
      },
      include: { article: true },
    });

    return apiSuccess(suggestion, 201);
  } catch (err) {
    console.error("[POST /api/reorder-suggestions]", err);
    return apiError("Bestellvorschlag konnte nicht gespeichert werden", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth("inventory.write");
    if (auth instanceof Response) return auth;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return apiError("id fehlt", 400);

    const existing = await prisma.manualReorderSuggestion.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!existing) return apiError("Vorschlag nicht gefunden", 404);

    await prisma.manualReorderSuggestion.delete({ where: { id } });
    return apiSuccess({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/reorder-suggestions]", err);
    return apiError("Bestellvorschlag konnte nicht gelöscht werden", 500);
  }
}
