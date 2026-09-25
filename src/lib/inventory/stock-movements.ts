import { prisma } from "@/lib/prisma";
import type { Prisma, StockMovementType } from "@/generated/prisma/client";

export type StockMovementExtras = {
  reason?: string | null;
  customerId?: string | null;
  employeeId?: string | null;
  purchasePriceNet?: number | null;
  salePriceNet?: number | null;
  supplierName?: string | null;
  occurredAt?: Date;
  receiptFileName?: string | null;
  receiptMimeType?: string | null;
  receiptStorageKey?: string | null;
  receiptSizeBytes?: number | null;
};

export async function applyStockMovement(params: {
  tenantId: string;
  articleId: string;
  storageLocationId: string;
  movementType: StockMovementType;
  quantity: number;
  orderId?: string | null;
  notes?: string | null;
  createdById?: string;
  /** Nur Admin darf negativen Bestand bewusst erlauben */
  allowNegative?: boolean;
  /** Reservierte Menge, die durch diesen Verbrauch gleichzeitig freigegeben wird. */
  reservedRelease?: number;
  /** Vorhandene Transaktion, wenn die Bestandsbewegung Teil eines größeren Vorgangs ist. */
  transaction?: Prisma.TransactionClient;
} & StockMovementExtras) {
  if (params.transaction) {
    return applyStockMovementWithClient(params.transaction, params);
  }
  return prisma.$transaction(
    (transaction) => applyStockMovementWithClient(transaction, params),
    { isolationLevel: "Serializable" }
  );
}

async function applyStockMovementWithClient(
  db: Prisma.TransactionClient,
  params: Parameters<typeof applyStockMovement>[0]
) {
  const balance = await db.stockBalance.findUnique({
    where: {
      articleId_storageLocationId: {
        articleId: params.articleId,
        storageLocationId: params.storageLocationId,
      },
    },
  });

  const currentOnHand = balance?.onHandQuantity ?? 0;
  const reserved = balance?.reservedQuantity ?? 0;
  const reservedRelease = Math.min(
    reserved,
    Math.max(0, Number(params.reservedRelease) || 0)
  );
  const newReserved = reserved - reservedRelease;

  let delta = 0;
  let movementQty = 0;

  if (params.movementType === "KORREKTUR") {
    const target = params.allowNegative ? params.quantity : Math.max(0, params.quantity);
    delta = target - currentOnHand;
    movementQty = Math.abs(delta);
    if (movementQty === 0) return { onHandQuantity: currentOnHand, movementId: null as string | null };
  } else {
    movementQty = Math.abs(params.quantity);
    if (movementQty <= 0) throw new Error("Menge muss größer als 0 sein");
    switch (params.movementType) {
      case "ZUGANG":
      case "RUECKGABE":
        delta = movementQty;
        break;
      case "ABGANG":
      case "VERBRAUCH":
        delta = -movementQty;
        break;
      default:
        delta = movementQty;
    }
  }

  const newOnHand = currentOnHand + delta;
  if (newOnHand < 0 && !params.allowNegative) {
    throw new Error(
      `Zu wenig Bestand: verfügbar ${currentOnHand}, angefragt ${movementQty}. Bestand darf nicht negativ werden.`
    );
  }
  if (newOnHand < newReserved && !params.allowNegative) {
    throw new Error(`Bestand darf nicht unter reservierte Menge (${newReserved}) fallen`);
  }

  const movement = await db.stockMovement.create({
    data: {
      tenantId: params.tenantId,
      articleId: params.articleId,
      storageLocationId: params.storageLocationId,
      orderId: params.orderId ?? undefined,
      customerId: params.customerId ?? undefined,
      employeeId: params.employeeId ?? undefined,
      movementType: params.movementType,
      reason: params.reason ?? undefined,
      quantity: movementQty,
      purchasePriceNet: params.purchasePriceNet ?? undefined,
      salePriceNet: params.salePriceNet ?? undefined,
      supplierName: params.supplierName ?? undefined,
      notes: params.notes ?? undefined,
      receiptFileName: params.receiptFileName ?? undefined,
      receiptMimeType: params.receiptMimeType ?? undefined,
      receiptStorageKey: params.receiptStorageKey ?? undefined,
      receiptSizeBytes: params.receiptSizeBytes ?? undefined,
      occurredAt: params.occurredAt ?? new Date(),
      createdById: params.createdById,
    },
  });
  await db.stockBalance.upsert({
    where: {
      articleId_storageLocationId: {
        articleId: params.articleId,
        storageLocationId: params.storageLocationId,
      },
    },
    create: {
      articleId: params.articleId,
      storageLocationId: params.storageLocationId,
      onHandQuantity: newOnHand,
      reservedQuantity: newReserved,
    },
    update: {
      onHandQuantity: newOnHand,
      ...(reservedRelease > 0 ? { reservedQuantity: newReserved } : {}),
    },
  });

  return { onHandQuantity: newOnHand, movementId: movement.id };
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
    reason: "SONSTIGES",
    notes: note,
    createdById: params.createdById,
  });
  await applyStockMovement({
    tenantId: params.tenantId,
    articleId: params.articleId,
    storageLocationId: params.toLocationId,
    movementType: "ZUGANG",
    quantity: params.quantity,
    reason: "SONSTIGES",
    notes: note,
    createdById: params.createdById,
  });
}
