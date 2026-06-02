import { prisma } from "@/lib/prisma";
import type { StockMovementType } from "@/generated/prisma/client";

export async function applyStockMovement(params: {
  tenantId: string;
  articleId: string;
  storageLocationId: string;
  movementType: StockMovementType;
  quantity: number;
  orderId?: string;
  notes?: string;
  createdById?: string;
}) {
  const qty = Math.abs(params.quantity);
  if (qty <= 0) throw new Error("Menge muss größer als 0 sein");

  const balance = await prisma.stockBalance.findUnique({
    where: {
      articleId_storageLocationId: {
        articleId: params.articleId,
        storageLocationId: params.storageLocationId,
      },
    },
  });

  let delta = 0;
  switch (params.movementType) {
    case "ZUGANG":
    case "RUECKGABE":
      delta = qty;
      break;
    case "ABGANG":
    case "VERBRAUCH":
      delta = -qty;
      break;
    default:
      delta = qty;
  }

  const newOnHand = (balance?.onHandQuantity ?? 0) + delta;
  if (newOnHand < 0) throw new Error("Bestand darf nicht negativ werden");

  await prisma.$transaction([
    prisma.stockMovement.create({
      data: {
        tenantId: params.tenantId,
        articleId: params.articleId,
        storageLocationId: params.storageLocationId,
        orderId: params.orderId,
        movementType: params.movementType,
        quantity: qty,
        notes: params.notes,
        createdById: params.createdById,
      },
    }),
    prisma.stockBalance.upsert({
      where: {
        articleId_storageLocationId: {
          articleId: params.articleId,
          storageLocationId: params.storageLocationId,
        },
      },
      create: {
        articleId: params.articleId,
        storageLocationId: params.storageLocationId,
        onHandQuantity: Math.max(0, newOnHand),
      },
      update: { onHandQuantity: newOnHand },
    }),
  ]);

  return newOnHand;
}

export async function transferStock(params: {
  tenantId: string;
  articleId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  notes?: string;
  createdById?: string;
}) {
  const note = params.notes ?? "Umbuchung";
  await applyStockMovement({
    tenantId: params.tenantId,
    articleId: params.articleId,
    storageLocationId: params.fromLocationId,
    movementType: "ABGANG",
    quantity: params.quantity,
    notes: note,
    createdById: params.createdById,
  });
  await applyStockMovement({
    tenantId: params.tenantId,
    articleId: params.articleId,
    storageLocationId: params.toLocationId,
    movementType: "ZUGANG",
    quantity: params.quantity,
    notes: note,
    createdById: params.createdById,
  });
}
