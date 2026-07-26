import { NextRequest } from "next/server";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { applyStockMovement, transferStock } from "@/lib/inventory/stock-movements";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const auth = await requireAuth("inventory.write");
  if (auth instanceof Response) return auth;

  const body = await request.json();

  if (body.transfer) {
    const { articleId, fromLocationId, toLocationId, quantity, notes } = body;
    if (!articleId || !fromLocationId || !toLocationId || !quantity) {
      return apiError("articleId, fromLocationId, toLocationId und quantity erforderlich", 400);
    }
    if (fromLocationId === toLocationId) {
      return apiError("Quell- und Ziellager müssen unterschiedlich sein", 400);
    }
    const [fromLoc, toLoc] = await Promise.all([
      prisma.storageLocation.findFirst({ where: { id: fromLocationId, tenantId: auth.tenantId } }),
      prisma.storageLocation.findFirst({ where: { id: toLocationId, tenantId: auth.tenantId } }),
    ]);
    if (!fromLoc || !toLoc) return apiError("Lagerort nicht gefunden", 404);

    const article = await prisma.article.findFirst({
      where: { id: articleId, tenantId: auth.tenantId, isActive: true },
    });
    if (!article) return apiError("Artikel nicht gefunden", 404);

    try {
      await transferStock({
        tenantId: auth.tenantId,
        articleId,
        fromLocationId,
        toLocationId,
        quantity: Number(quantity),
        notes: notes ?? `Umbuchung: ${fromLoc.name} → ${toLoc.name}`,
        createdById: auth.id,
      });
    } catch (err) {
      return apiError(err instanceof Error ? err.message : "Umbuchung fehlgeschlagen", 400);
    }
    return apiSuccess({ transferred: true, from: fromLoc.name, to: toLoc.name });
  }

  const { articleId, storageLocationId, movementType, quantity, orderId, notes } = body;
  if (!articleId || !storageLocationId || !movementType || quantity == null) {
    return apiError("articleId, storageLocationId, movementType und quantity erforderlich", 400);
  }

  const qty = Number(quantity);
  if (Number.isNaN(qty)) return apiError("Ungültige Menge", 400);
  if (movementType === "KORREKTUR") {
    if (qty < 0) return apiError("Ist-Bestand darf nicht negativ sein", 400);
  } else if (qty <= 0) {
    return apiError("Menge muss größer als 0 sein", 400);
  }

  const [article, location] = await Promise.all([
    prisma.article.findFirst({ where: { id: articleId, tenantId: auth.tenantId, isActive: true } }),
    prisma.storageLocation.findFirst({ where: { id: storageLocationId, tenantId: auth.tenantId, isActive: true } }),
  ]);
  if (!article) return apiError("Artikel nicht gefunden", 404);
  if (!location) return apiError("Lagerort nicht gefunden", 404);

  try {
    const result = await applyStockMovement({
      tenantId: auth.tenantId,
      articleId,
      storageLocationId,
      movementType,
      quantity: qty,
      orderId,
      notes,
      createdById: auth.id,
    });
    return apiSuccess({ onHandQuantity: result.onHandQuantity });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : "Bestandsbuchung fehlgeschlagen", 400);
  }
}
