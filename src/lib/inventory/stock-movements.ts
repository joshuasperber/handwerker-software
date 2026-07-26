import { prisma } from "@/lib/prisma";
import type { StockMovementType } from "@/generated/prisma/client";

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
} & StockMovementExtras) {
  const balance = await prisma.stockBalance.findUnique({
    where: {
      articleId_storageLocationId: {
        articleId: params.articleId,
        storageLocationId: params.storageLocationId,
      },
    },
  });

  const currentOnHand = balance?.onHandQuantity ?? 0;
  const reserved = balance?.reservedQuantity ?? 0;

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
  if (newOnHand < reserved && !params.allowNegative) {
    throw new Error(`Bestand darf nicht unter reservierte Menge (${reserved}) fallen`);
  }

  const [movement] = await prisma.$transaction([
    prisma.stockMovement.create({
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
        onHandQuantity: newOnHand,
      },
      update: { onHandQuantity: newOnHand },
    }),
  ]);

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
