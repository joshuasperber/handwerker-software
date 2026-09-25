import type { Prisma } from "@/generated/prisma/client";

type OrderedLine = { articleId: string; quantity: number };

export function planOrderedQuantityRelease(
  balances: Array<{ id: string; storageLocationId: string; orderedQuantity: number }>,
  quantity: number,
  preferredLocationId: string
) {
  const ordered = [...balances].sort((a, b) =>
    a.storageLocationId === preferredLocationId
      ? -1
      : b.storageLocationId === preferredLocationId
        ? 1
        : 0
  );
  let remaining = Math.max(0, quantity);
  return ordered.flatMap((balance) => {
    if (remaining <= 0 || balance.orderedQuantity <= 0) return [];
    const released = Math.min(balance.orderedQuantity, remaining);
    remaining -= released;
    return [{ id: balance.id, nextOrderedQuantity: balance.orderedQuantity - released }];
  });
}

export async function addOrderedQuantities(
  transaction: Prisma.TransactionClient,
  tenantId: string,
  lines: OrderedLine[]
) {
  const mainLocation = await transaction.storageLocation.findFirst({
    where: { tenantId, locationType: "HAUPTLAGER", isActive: true },
    select: { id: true },
  });
  if (!mainLocation) throw new Error("Kein aktives Hauptlager angelegt");

  for (const line of lines) {
    await transaction.stockBalance.upsert({
      where: {
        articleId_storageLocationId: {
          articleId: line.articleId,
          storageLocationId: mainLocation.id,
        },
      },
      create: {
        articleId: line.articleId,
        storageLocationId: mainLocation.id,
        orderedQuantity: line.quantity,
      },
      update: { orderedQuantity: { increment: line.quantity } },
    });
  }
}

/**
 * Reduziert offene Bestellmengen ohne einen Lagerbestand unter null zu ziehen.
 * Altdaten können die Bestellmenge noch auf mehreren Lagerorten enthalten; daher
 * wird zuerst der Zielort und anschließend jede weitere positive Menge abgebaut.
 */
export async function releaseOrderedQuantity(
  transaction: Prisma.TransactionClient,
  tenantId: string,
  articleId: string,
  quantity: number,
  preferredLocationId: string
) {
  const balances = await transaction.stockBalance.findMany({
    where: {
      articleId,
      orderedQuantity: { gt: 0 },
      article: { tenantId },
    },
    select: { id: true, storageLocationId: true, orderedQuantity: true },
  });
  const releases = planOrderedQuantityRelease(
    balances,
    quantity,
    preferredLocationId
  );
  for (const release of releases) {
    await transaction.stockBalance.update({
      where: { id: release.id },
      data: { orderedQuantity: release.nextOrderedQuantity },
    });
  }
}
