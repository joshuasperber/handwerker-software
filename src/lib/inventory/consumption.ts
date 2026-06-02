import { prisma } from "@/lib/prisma";
import { applyStockMovement } from "./stock-movements";
import { checkOrderMaterialStatus } from "./orders";

export async function bookOrderConsumption(params: {
  tenantId: string;
  orderId: string;
  lines: { lineId: string; quantityConsumed: number; returned?: number }[];
  employeeId?: string;
}) {
  const mainLocation = await prisma.storageLocation.findFirst({
    where: { tenantId: params.tenantId, locationType: "HAUPTLAGER" },
  });

  for (const item of params.lines) {
    const line = await prisma.orderMaterialLine.findFirst({
      where: { id: item.lineId, orderId: params.orderId },
      include: { reservations: { where: { status: "RESERVIERT" } } },
    });
    if (!line || line.isTool || !line.articleId) continue;

    const consumeQty = item.quantityConsumed;
    const returnQty = item.returned ?? 0;

    const reservation = line.reservations[0];
    const locationId = reservation?.storageLocationId ?? mainLocation?.id;
    if (!locationId) continue;

    if (consumeQty > 0) {
      await applyStockMovement({
        tenantId: params.tenantId,
        articleId: line.articleId,
        storageLocationId: locationId,
        movementType: "VERBRAUCH",
        quantity: consumeQty,
        orderId: params.orderId,
        notes: `Verbrauch Auftrag ${params.orderId}`,
      });

      if (reservation) {
        const releaseQty = Math.min(reservation.quantity, consumeQty);
        await prisma.stockBalance.update({
          where: {
            articleId_storageLocationId: {
              articleId: line.articleId,
              storageLocationId: locationId,
            },
          },
          data: { reservedQuantity: { decrement: releaseQty } },
        });
        await prisma.reservation.update({
          where: { id: reservation.id },
          data: { status: "VERBRAUCHT" },
        });
      }
    }

    if (returnQty > 0) {
      await applyStockMovement({
        tenantId: params.tenantId,
        articleId: line.articleId,
        storageLocationId: locationId,
        movementType: "RUECKGABE",
        quantity: returnQty,
        orderId: params.orderId,
      });
    }

    await prisma.orderMaterialLine.update({
      where: { id: line.id },
      data: {
        quantityConsumed: { increment: consumeQty - returnQty },
        lineStatus: "CONSUMED",
      },
    });

    await prisma.materialUsage.create({
      data: {
        orderId: params.orderId,
        employeeId: params.employeeId ?? (await getAnyEmployeeId(params.tenantId)),
        name: line.name,
        quantity: consumeQty,
        unit: line.unit,
      },
    });
  }

  await prisma.order.update({
    where: { id: params.orderId },
    data: { materialStatus: "CONSUMED" },
  });

  return checkOrderMaterialStatus(params.orderId, params.tenantId);
}

async function getAnyEmployeeId(tenantId: string): Promise<string> {
  const emp = await prisma.employee.findFirst({ where: { tenantId } });
  if (!emp) throw new Error("Kein Mitarbeiter gefunden");
  return emp.id;
}

export async function receivePurchaseOrder(
  tenantId: string,
  purchaseOrderId: string,
  lines: { lineId: string; quantityReceived: number }[],
  storageLocationId?: string
) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, tenantId },
    include: { lines: true },
  });
  if (!po) throw new Error("Bestellung nicht gefunden");

  let targetLocationId = storageLocationId;
  if (!targetLocationId) {
    const mainLocation = await prisma.storageLocation.findFirst({
      where: { tenantId, locationType: "HAUPTLAGER" },
    });
    if (!mainLocation) throw new Error("Kein Hauptlager – bitte Lagerort wählen");
    targetLocationId = mainLocation.id;
  }

  const location = await prisma.storageLocation.findFirst({
    where: { id: targetLocationId, tenantId },
  });
  if (!location) throw new Error("Lagerort nicht gefunden");

  for (const item of lines) {
    const line = po.lines.find((l) => l.id === item.lineId);
    if (!line || item.quantityReceived <= 0) continue;

    await applyStockMovement({
      tenantId,
      articleId: line.articleId,
      storageLocationId: targetLocationId,
      movementType: "ZUGANG",
      quantity: item.quantityReceived,
      notes: `Wareneingang ${po.poNumber} → ${location.name}`,
    });

    await prisma.purchaseOrderLine.update({
      where: { id: line.id },
      data: { quantityReceived: { increment: item.quantityReceived } },
    });

    await prisma.stockBalance.updateMany({
      where: { articleId: line.articleId },
      data: { orderedQuantity: { decrement: Math.min(item.quantityReceived, line.quantityOrdered) } },
    });
  }

  const updated = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { lines: true },
  });

  const allReceived = updated!.lines.every((l) => l.quantityReceived >= l.quantityOrdered);
  const anyReceived = updated!.lines.some((l) => l.quantityReceived > 0);

  const status = allReceived ? "DELIVERED" : anyReceived ? "PARTLY_DELIVERED" : po.status;

  await prisma.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: { status },
  });

  await prisma.delivery.create({
    data: {
      tenantId,
      purchaseOrderId,
      status,
      deliveredAt: new Date(),
      notes: `Eingelagert in: ${location.name}`,
    },
  });

  return updated;
}
