import { prisma } from "@/lib/prisma";
import { applyStockMovement } from "./stock-movements";
import { checkOrderMaterialStatus } from "./orders";
import {
  validateConsumptionLines,
  type ConsumptionLineInput,
} from "./consumption-validation";
import { releaseOrderedQuantity } from "./purchase-order-stock";

export async function bookOrderConsumption(params: {
  tenantId: string;
  orderId: string;
  lines: ConsumptionLineInput[];
  employeeId: string;
}) {
  const parsed = validateConsumptionLines(params.lines);
  if ("error" in parsed) throw new Error(parsed.error);

  let fullyConsumed: boolean;
  try {
    fullyConsumed = await prisma.$transaction(async (transaction) => {
      const employee = await transaction.employee.findFirst({
        where: { id: params.employeeId, tenantId: params.tenantId },
        select: { id: true },
      });
      if (!employee) throw new Error("Mitarbeiter nicht gefunden");

      const mainLocation = await transaction.storageLocation.findFirst({
        where: { tenantId: params.tenantId, locationType: "HAUPTLAGER" },
      });

      for (const item of parsed.lines) {
        const line = await transaction.orderMaterialLine.findFirst({
          where: {
            id: item.lineId,
            orderId: params.orderId,
            order: { tenantId: params.tenantId },
          },
          include: { reservations: { where: { status: "RESERVIERT" } } },
        });
        if (!line) throw new Error("Materialposition nicht gefunden");
        if (line.isTool || !line.articleId) {
          throw new Error(`„${line.name}“ kann nicht als Verbrauch gebucht werden`);
        }

        const consumeQty = item.quantityConsumed;
        const returnQty = item.returned ?? 0;
        if (returnQty > line.quantityConsumed + consumeQty) {
          throw new Error(
            `Rückgabe für „${line.name}“ ist größer als der bisherige Verbrauch.`
          );
        }

        const reservation = line.reservations[0];
        const locationId = reservation?.storageLocationId ?? mainLocation?.id;
        if (!locationId) throw new Error("Kein Lagerort für die Materialbuchung vorhanden");

        if (consumeQty > 0) {
          const releaseQty = reservation
            ? Math.min(reservation.quantity, consumeQty)
            : 0;
          await applyStockMovement({
            tenantId: params.tenantId,
            articleId: line.articleId,
            storageLocationId: locationId,
            movementType: "VERBRAUCH",
            quantity: consumeQty,
            orderId: params.orderId,
            employeeId: params.employeeId,
            reservedRelease: releaseQty,
            notes: `Verbrauch Auftrag ${params.orderId}`,
            transaction,
          });

          if (reservation) {
            await transaction.reservation.update({
              where: { id: reservation.id },
              data:
                releaseQty >= reservation.quantity
                  ? { status: "VERBRAUCHT" }
                  : { quantity: { decrement: releaseQty } },
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
            employeeId: params.employeeId,
            transaction,
          });
        }

        const nextConsumed = line.quantityConsumed + consumeQty - returnQty;
        await transaction.orderMaterialLine.update({
          where: { id: line.id },
          data: {
            quantityConsumed: nextConsumed,
            ...(nextConsumed >= line.quantityRequired
              ? { lineStatus: "CONSUMED" }
              : {}),
          },
        });

        const netUsage = consumeQty - returnQty;
        if (netUsage !== 0) {
          await transaction.materialUsage.create({
            data: {
              orderId: params.orderId,
              employeeId: params.employeeId,
              name: line.name,
              quantity: netUsage,
              unit: line.unit,
              notes: netUsage < 0 ? "Materialrückgabe" : null,
            },
          });
        }
      }

      const materialLines = await transaction.orderMaterialLine.findMany({
        where: { orderId: params.orderId, isTool: false },
        select: { quantityRequired: true, quantityConsumed: true },
      });
      const complete =
        materialLines.length > 0 &&
        materialLines.every((line) => line.quantityConsumed >= line.quantityRequired);
      if (complete) {
        await transaction.order.update({
          where: { id: params.orderId },
          data: { materialStatus: "CONSUMED" },
        });
      }
      return complete;
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if ((error as { code?: string }).code === "P2034") {
      throw new Error("Der Bestand wurde parallel geändert. Bitte erneut versuchen.");
    }
    throw error;
  }

  if (fullyConsumed) return "CONSUMED" as const;

  return checkOrderMaterialStatus(params.orderId, params.tenantId);
}

export async function receivePurchaseOrder(
  tenantId: string,
  purchaseOrderId: string,
  lines: { lineId: string; quantityReceived: number }[],
  storageLocationId?: string
) {
  if (!lines.length) throw new Error("Mindestens eine Wareneingangsposition erforderlich");
  if (new Set(lines.map((line) => line.lineId)).size !== lines.length) {
    throw new Error("Eine Bestellposition darf pro Wareneingang nur einmal vorkommen");
  }
  if (lines.some((line) => !Number.isFinite(line.quantityReceived) || line.quantityReceived <= 0)) {
    throw new Error("Wareneingangsmengen müssen größer als 0 sein");
  }

  try {
    return await prisma.$transaction(async (transaction) => {
      const po = await transaction.purchaseOrder.findFirst({
        where: { id: purchaseOrderId, tenantId },
        include: { lines: true },
      });
      if (!po) throw new Error("Bestellung nicht gefunden");

      let targetLocationId = storageLocationId;
      if (!targetLocationId) {
        const mainLocation = await transaction.storageLocation.findFirst({
          where: { tenantId, locationType: "HAUPTLAGER", isActive: true },
          select: { id: true },
        });
        if (!mainLocation) throw new Error("Kein Hauptlager – bitte Lagerort wählen");
        targetLocationId = mainLocation.id;
      }

      const location = await transaction.storageLocation.findFirst({
        where: { id: targetLocationId, tenantId, isActive: true },
        select: { id: true, name: true },
      });
      if (!location) throw new Error("Lagerort nicht gefunden");

      for (const item of lines) {
        const line = po.lines.find((candidate) => candidate.id === item.lineId);
        if (!line) throw new Error("Bestellposition nicht gefunden");
        const outstanding = line.quantityOrdered - line.quantityReceived;
        if (item.quantityReceived > outstanding) {
          throw new Error(
            `Wareneingang überschreitet die offene Menge (${outstanding})`
          );
        }

        await applyStockMovement({
          tenantId,
          articleId: line.articleId,
          storageLocationId: location.id,
          movementType: "ZUGANG",
          quantity: item.quantityReceived,
          notes: `Wareneingang ${po.poNumber} → ${location.name}`,
          transaction,
        });
        await transaction.purchaseOrderLine.update({
          where: { id: line.id },
          data: { quantityReceived: { increment: item.quantityReceived } },
        });
        await releaseOrderedQuantity(
          transaction,
          tenantId,
          line.articleId,
          item.quantityReceived,
          location.id
        );
      }

      const updated = await transaction.purchaseOrder.findUniqueOrThrow({
        where: { id: purchaseOrderId },
        include: { lines: true },
      });
      const allReceived = updated.lines.every(
        (line) => line.quantityReceived >= line.quantityOrdered
      );
      const anyReceived = updated.lines.some((line) => line.quantityReceived > 0);
      const status = allReceived
        ? "DELIVERED"
        : anyReceived
          ? "PARTLY_DELIVERED"
          : po.status;

      const result = await transaction.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: { status },
        include: { lines: true },
      });
      await transaction.delivery.create({
        data: {
          tenantId,
          purchaseOrderId,
          status,
          deliveredAt: new Date(),
          notes: `Eingelagert in: ${location.name}`,
        },
      });
      return result;
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if ((error as { code?: string }).code === "P2034") {
      throw new Error("Der Wareneingang wurde parallel geändert. Bitte erneut versuchen.");
    }
    throw error;
  }
}
