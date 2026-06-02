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

    await transferStock({
      tenantId: auth.tenantId,
      articleId,
      fromLocationId,
      toLocationId,
      quantity: Number(quantity),
      notes: notes ?? `Umbuchung: ${fromLoc.name} → ${toLoc.name}`,
      createdById: auth.id,
    });
    return apiSuccess({ transferred: true, from: fromLoc.name, to: toLoc.name });
  }

  const { articleId, storageLocationId, movementType, quantity, orderId, notes } = body;
  if (!articleId || !storageLocationId || !movementType || !quantity) {
    return apiError("articleId, storageLocationId, movementType und quantity erforderlich", 400);
  }

  const newOnHand = await applyStockMovement({
    tenantId: auth.tenantId,
    articleId,
    storageLocationId,
    movementType,
    quantity: Number(quantity),
    orderId,
    notes,
    createdById: auth.id,
  });

  return apiSuccess({ onHandQuantity: newOnHand });
}
