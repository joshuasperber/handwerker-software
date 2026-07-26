import { NextRequest } from "next/server";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { applyStockMovement } from "@/lib/inventory/stock-movements";
import { prisma } from "@/lib/prisma";
import {
  WITHDRAWAL_REASONS,
  calcDocumentedUnitMargin,
  withdrawalMovementType,
} from "@/lib/inventory/reasons";

export async function POST(request: NextRequest) {
  const auth = await requireAuth("inventory.write");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const {
    articleId,
    storageLocationId,
    quantity,
    reason,
    orderId,
    customerId,
    employeeId,
    purchasePriceNet,
    salePriceNet,
    notes,
    occurredAt,
    allowNegative,
  } = body;

  if (!articleId || !storageLocationId || quantity == null || !reason) {
    return apiError("Artikel, Lagerort, Menge und Grund sind Pflicht", 400);
  }

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return apiError("Menge muss größer als 0 sein", 400);
  }

  const validReason = WITHDRAWAL_REASONS.some((r) => r.value === reason);
  if (!validReason) return apiError("Ungültiger Entnahmegrund", 400);

  const wantNegative = allowNegative === true;
  if (wantNegative && auth.role !== "ADMIN") {
    return apiError("Nur Administratoren dürfen negativen Bestand erlauben", 403);
  }

  const [article, location] = await Promise.all([
    prisma.article.findFirst({ where: { id: articleId, tenantId: auth.tenantId, isActive: true } }),
    prisma.storageLocation.findFirst({
      where: { id: storageLocationId, tenantId: auth.tenantId, isActive: true },
    }),
  ]);
  if (!article) return apiError("Artikel nicht gefunden", 404);
  if (!location) return apiError("Lagerort nicht gefunden", 404);

  if (orderId) {
    const order = await prisma.order.findFirst({ where: { id: orderId, tenantId: auth.tenantId } });
    if (!order) return apiError("Auftrag nicht gefunden", 404);
  }
  if (customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: auth.tenantId },
    });
    if (!customer) return apiError("Kunde nicht gefunden", 404);
  }
  if (employeeId) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, tenantId: auth.tenantId },
    });
    if (!employee) return apiError("Mitarbeiter nicht gefunden", 404);
  }

  const balance = await prisma.stockBalance.findUnique({
    where: {
      articleId_storageLocationId: { articleId, storageLocationId },
    },
  });
  const onHand = balance?.onHandQuantity ?? 0;
  const reserved = balance?.reservedQuantity ?? 0;
  const available = onHand - reserved;

  if (qty > available && !wantNegative) {
    return apiError(
      `Zu wenig Bestand: nur ${available} ${article.unit} verfügbar (${onHand} Bestand, ${reserved} reserviert).`,
      400
    );
  }

  const purchase =
    purchasePriceNet != null && purchasePriceNet !== ""
      ? Number(purchasePriceNet)
      : article.purchasePriceNet;
  const sale =
    salePriceNet != null && salePriceNet !== "" ? Number(salePriceNet) : null;

  try {
    const result = await applyStockMovement({
      tenantId: auth.tenantId,
      articleId,
      storageLocationId,
      movementType: withdrawalMovementType(String(reason)),
      quantity: qty,
      reason: String(reason),
      orderId: orderId || null,
      customerId: customerId || null,
      employeeId: employeeId || null,
      purchasePriceNet: purchase != null && Number.isFinite(purchase) ? purchase : null,
      salePriceNet: sale != null && Number.isFinite(sale) ? sale : null,
      notes: notes ? String(notes) : null,
      occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      createdById: auth.id,
      allowNegative: wantNegative,
    });

    const unitMargin = calcDocumentedUnitMargin(purchase, sale);
    return apiSuccess({
      onHandQuantity: result.onHandQuantity,
      movementId: result.movementId,
      previousOnHand: onHand,
      withdrawn: qty,
      unit: article.unit,
      documentedUnitMargin: unitMargin,
      documentedTotalMargin:
        unitMargin != null ? Math.round(unitMargin * qty * 100) / 100 : null,
      message: `Entnahme gebucht: ${qty} ${article.unit}. Bestand jetzt ${result.onHandQuantity} ${article.unit}.`,
    });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : "Entnahme fehlgeschlagen", 400);
  }
}
