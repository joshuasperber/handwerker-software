import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { calcAvailableQuantity } from "@/lib/inventory/formulas";

export async function GET() {
  const auth = await requireAuth("inventory.read");
  if (auth instanceof Response) return auth;

  const articles = await prisma.article.findMany({
    where: { tenantId: auth.tenantId, isActive: true },
    include: {
      stockBalances: { include: { storageLocation: true } },
    },
    orderBy: { name: "asc" },
  });

  const data = articles.map((a) => {
    const onHand = a.stockBalances.reduce((s, b) => s + b.onHandQuantity, 0);
    const reserved = a.stockBalances.reduce((s, b) => s + b.reservedQuantity, 0);
    const ordered = a.stockBalances.reduce((s, b) => s + b.orderedQuantity, 0);
    const available = calcAvailableQuantity(onHand, reserved);
    const lowStock = available < a.minimumStock;
    return { ...a, totals: { onHand, reserved, ordered, available, lowStock } };
  });

  return apiSuccess(data);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("inventory.write");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  if (!body.name) return apiError("Artikelname ist Pflicht", 400);

  const article = await prisma.article.create({
    data: {
      tenantId: auth.tenantId,
      name: body.name,
      sku: body.sku,
      unit: body.unit ?? "Stk",
      category: body.category,
      articleType: body.articleType ?? "MATERIAL",
      minimumStock: Number(body.minimumStock ?? 0),
      targetStock: Number(body.targetStock ?? 0),
      reorderQuantity: Number(body.reorderQuantity ?? 0),
      packageSize: Number(body.packageSize ?? 1),
      reorderStrategy: body.reorderStrategy ?? "MANUELL",
      supplierName: body.supplierName,
      purchasePriceNet: body.purchasePriceNet != null ? Number(body.purchasePriceNet) : undefined,
    },
  });

  // Ziellager: explizit gewähltes Lager, sonst Hauptlager als Fallback.
  let targetLocation = null;
  if (body.initialLocationId) {
    targetLocation = await prisma.storageLocation.findFirst({
      where: { id: String(body.initialLocationId), tenantId: auth.tenantId },
    });
  }
  if (!targetLocation) {
    targetLocation = await prisma.storageLocation.findFirst({
      where: { tenantId: auth.tenantId, locationType: "HAUPTLAGER" },
    });
  }

  if (targetLocation && body.initialStock != null && Number(body.initialStock) > 0) {
    const qty = Number(body.initialStock);
    await prisma.$transaction([
      prisma.stockBalance.create({
        data: {
          articleId: article.id,
          storageLocationId: targetLocation.id,
          onHandQuantity: qty,
        },
      }),
      prisma.stockMovement.create({
        data: {
          tenantId: auth.tenantId,
          articleId: article.id,
          storageLocationId: targetLocation.id,
          movementType: "ZUGANG",
          quantity: qty,
          notes: `Anfangsbestand (${targetLocation.name})`,
        },
      }),
    ]);
  }

  return apiSuccess(article, 201);
}
