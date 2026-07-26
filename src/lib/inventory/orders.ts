import { prisma } from "@/lib/prisma";
import { calcAvailableQuantity } from "./formulas";
import { articlePriceForCalculation } from "./units";
import { standardPhaseCreateData } from "@/lib/orders/phases";
import type { MaterialOrderStatus, OrderType, ReservationStatus } from "@/generated/prisma/client";
import type { OrderMaterialLineInput } from "@/lib/orders/material-lines";
import { resolveOrderTypeAssignment } from "@/lib/orders/order-types";

export async function getArticleAvailability(tenantId: string, articleId: string) {
  const balances = await prisma.stockBalance.findMany({
    where: { article: { id: articleId, tenantId } },
    include: { storageLocation: true },
  });

  const onHand = balances.reduce((s, b) => s + b.onHandQuantity, 0);
  const reserved = balances.reduce((s, b) => s + b.reservedQuantity, 0);
  const ordered = balances.reduce((s, b) => s + b.orderedQuantity, 0);

  return {
    onHand,
    reserved,
    ordered,
    available: calcAvailableQuantity(onHand, reserved),
    byLocation: balances.map((b) => ({
      locationId: b.storageLocationId,
      locationName: b.storageLocation.name,
      onHand: b.onHandQuantity,
      reserved: b.reservedQuantity,
      available: calcAvailableQuantity(b.onHandQuantity, b.reservedQuantity),
    })),
  };
}

export async function generateMaterialLinesFromServices(orderId: string, serviceIds: string[]) {
  const templates = await prisma.serviceMaterialTemplate.findMany({
    where: { serviceId: { in: serviceIds } },
    include: { article: true },
    orderBy: [{ serviceId: "asc" }, { sortOrder: "asc" }],
  });

  const lines: {
    orderId: string;
    articleId: string | null;
    sourceServiceId: string;
    name: string;
    quantityRequired: number;
    unit: string;
    unitPriceNet: number | null;
    isTool: boolean;
    lineStatus: MaterialOrderStatus;
  }[] = [];

  for (const t of templates) {
    lines.push({
      orderId,
      articleId: t.articleId,
      sourceServiceId: t.serviceId,
      name: t.article?.name ?? t.name,
      quantityRequired: t.defaultQuantity,
      unit: t.unit,
      unitPriceNet: t.article ? articlePriceForCalculation(t.article) : null,
      isTool: t.isTool,
      lineStatus: "NOT_CHECKED",
    });
  }

  if (lines.length) {
    await prisma.orderMaterialLine.createMany({ data: lines });
  }

  return lines.length;
}

export async function checkOrderMaterialStatus(orderId: string, tenantId: string): Promise<MaterialOrderStatus> {
  const lines = await prisma.orderMaterialLine.findMany({
    where: { orderId, isTool: false },
    include: { article: true },
  });

  if (!lines.length) return "NOT_CHECKED";

  let allComplete = true;
  let anyMissing = false;
  let anyPartial = false;

  for (const line of lines) {
    if (!line.articleId) {
      anyPartial = true;
      allComplete = false;
      continue;
    }
    const avail = await getArticleAvailability(tenantId, line.articleId);
    if (avail.available >= line.quantityRequired) continue;
    if (avail.available > 0) {
      anyPartial = true;
      allComplete = false;
    } else {
      anyMissing = true;
      allComplete = false;
    }
  }

  let status: MaterialOrderStatus = "COMPLETE";
  if (anyMissing) status = "MISSING";
  else if (anyPartial) status = "PARTLY_AVAILABLE";
  else if (!allComplete) status = "PARTLY_AVAILABLE";

  await prisma.order.update({
    where: { id: orderId },
    data: { materialStatus: status },
  });

  await prisma.orderMaterialLine.updateMany({
    where: { orderId, isTool: false },
    data: { lineStatus: status === "COMPLETE" ? "COMPLETE" : status },
  });

  return status;
}

export async function confirmReservationsForOrder(orderId: string, tenantId: string) {
  const mainLocation = await prisma.storageLocation.findFirst({
    where: { tenantId, locationType: "HAUPTLAGER", isActive: true },
  });
  if (!mainLocation) throw new Error("Kein Hauptlager angelegt");

  const lines = await prisma.orderMaterialLine.findMany({
    where: { orderId, isTool: false, articleId: { not: null } },
  });

  for (const line of lines) {
    if (!line.articleId) continue;

    const balance = await prisma.stockBalance.findUnique({
      where: {
        articleId_storageLocationId: {
          articleId: line.articleId,
          storageLocationId: mainLocation.id,
        },
      },
    });

    const onHand = balance?.onHandQuantity ?? 0;
    const reserved = balance?.reservedQuantity ?? 0;
    const available = calcAvailableQuantity(onHand, reserved);
    const qty = Math.min(line.quantityRequired, available);
    if (qty <= 0) continue;

    await prisma.$transaction([
      prisma.reservation.create({
        data: {
          tenantId,
          orderId,
          orderMaterialLineId: line.id,
          articleId: line.articleId,
          storageLocationId: mainLocation.id,
          quantity: qty,
          status: "RESERVIERT" as ReservationStatus,
        },
      }),
      prisma.stockBalance.upsert({
        where: {
          articleId_storageLocationId: {
            articleId: line.articleId,
            storageLocationId: mainLocation.id,
          },
        },
        create: {
          articleId: line.articleId,
          storageLocationId: mainLocation.id,
          onHandQuantity: onHand,
          reservedQuantity: qty,
        },
        update: { reservedQuantity: { increment: qty } },
      }),
    ]);
  }

  return checkOrderMaterialStatus(orderId, tenantId);
}

/**
 * Standardphasen für jeden neuen Auftrag (Aufmaß, Angebot, Fertigen, Montieren,
 * Rechnung). Der Auftragstyp wird der Einheitlichkeit halber nicht mehr für
 * unterschiedliche Phasensätze genutzt – die Phasen lassen sich pro Auftrag
 * individuell aktivieren, deaktivieren und sortieren.
 */
export function defaultPhasesForOrderType(_orderType?: OrderType | string | null) {
  void _orderType;
  return standardPhaseCreateData();
}

export async function createOrderWithWizardData(
  tenantId: string,
  data: {
    customerId: string;
    propertyId: string;
    title: string;
    orderTypeId?: string | null;
    orderTypeCustom?: string | null;
    /** Legacy-Fallback (Enum-Key). */
    orderType?: string | null;
    description?: string;
    internalNotes?: string;
    serviceIds: string[];
    customServices?: {
      name: string;
      description?: string;
      quantity?: number;
      unitPriceCents?: number;
      notes?: string;
    }[];
    employeeId?: string;
    scheduledStart?: string;
    scheduledEnd?: string;
    priority?: string;
    confirmMaterial?: boolean;
    /** Wenn gesetzt (auch leeres Array): ersetzt die automatische Stücklisten-Erzeugung. */
    materialLines?: OrderMaterialLineInput[];
  }
) {
  const { generateOrderNumber } = await import("@/lib/utils");

  const typeAssignment = await resolveOrderTypeAssignment(tenantId, {
    orderTypeId: data.orderTypeId,
    orderTypeCustom: data.orderTypeCustom,
    orderType: data.orderType,
  });
  if ("error" in typeAssignment) {
    throw new Error(typeAssignment.error);
  }

  const customServiceCreates = (data.customServices ?? [])
    .filter((c) => c.name?.trim())
    .map((c) => ({
      customName: c.name.trim(),
      description: c.description?.trim() || null,
      quantity: c.quantity && c.quantity > 0 ? Math.round(c.quantity) : 1,
      unitPriceCents:
        c.unitPriceCents != null && Number.isFinite(c.unitPriceCents)
          ? Math.round(c.unitPriceCents)
          : null,
      notes: c.notes?.trim() || null,
    }));

  const order = await prisma.order.create({
    data: {
      tenantId,
      customerId: data.customerId,
      propertyId: data.propertyId,
      orderNumber: generateOrderNumber(),
      title: data.title,
      orderType: typeAssignment.orderType,
      orderTypeId: typeAssignment.orderTypeId,
      orderTypeLabel: typeAssignment.orderTypeLabel,
      orderTypeCustom: typeAssignment.orderTypeCustom,
      description: data.description,
      internalNotes: data.internalNotes,
      priority: (data.priority as never) ?? "NORMAL",
      status: data.scheduledStart ? "EINGEPLANT" : "NEUE_ANFRAGE",
      scheduledStart: data.scheduledStart ? new Date(data.scheduledStart) : undefined,
      scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd) : undefined,
      services: {
        create: [
          ...data.serviceIds.map((serviceId) => ({ serviceId })),
          ...customServiceCreates,
        ],
      },
      phases: {
        create: defaultPhasesForOrderType(typeAssignment.orderType),
      },
    },
    include: {
      customer: true,
      property: true,
      phases: true,
      services: { include: { service: true } },
      orderTypeDefinition: true,
    },
  });

  if (data.materialLines) {
    const creates = data.materialLines
      .filter((l) => l.name?.trim() && l.quantityRequired > 0)
      .map((l) => ({
        orderId: order.id,
        articleId: l.articleId || null,
        sourceServiceId: l.sourceServiceId || null,
        name: l.name.trim(),
        quantityRequired: l.quantityRequired,
        unit: l.unit?.trim() || "Stück",
        unitPriceNet: l.unitPriceNet ?? null,
        notes: l.notes ?? null,
        isTool: l.isTool === true,
        lineStatus: "NOT_CHECKED" as MaterialOrderStatus,
      }));
    if (creates.length) {
      await prisma.orderMaterialLine.createMany({ data: creates });
    }
    // Werkzeuge aus Leistungsverzeichnis weiterhin automatisch übernehmen
    const toolTemplates = await prisma.serviceMaterialTemplate.findMany({
      where: { serviceId: { in: data.serviceIds }, isTool: true },
      include: { article: true },
    });
    if (toolTemplates.length) {
      await prisma.orderMaterialLine.createMany({
        data: toolTemplates.map((t) => ({
          orderId: order.id,
          articleId: t.articleId,
          sourceServiceId: t.serviceId,
          name: t.article?.name ?? t.name,
          quantityRequired: t.defaultQuantity,
          unit: t.unit,
          unitPriceNet: null,
          isTool: true,
          lineStatus: "NOT_CHECKED" as MaterialOrderStatus,
        })),
      });
    }
  } else {
    await generateMaterialLinesFromServices(order.id, data.serviceIds);
  }

  await checkOrderMaterialStatus(order.id, tenantId);

  if (data.confirmMaterial) {
    await confirmReservationsForOrder(order.id, tenantId);
  }

  // Sobald ein Termin gesetzt ist, wird ein Kalendereintrag erzeugt – auch ohne
  // zugewiesenen Monteur. So erscheint der Auftrag direkt im Team-Kalender und
  // kann später per Drag-and-drop einem Mitarbeiter zugeordnet werden.
  if (data.scheduledStart) {
    const start = new Date(data.scheduledStart);
    const end = data.scheduledEnd
      ? new Date(data.scheduledEnd)
      : new Date(start.getTime() + 2 * 60 * 60 * 1000);
    await prisma.appointment.create({
      data: {
        tenantId,
        orderId: order.id,
        employeeId: data.employeeId || null,
        startTime: start,
        endTime: end,
        status: "GEPLANT",
      },
    });
  }

  return prisma.order.findUnique({
    where: { id: order.id },
    include: {
      customer: true,
      property: true,
      phases: { orderBy: { sortOrder: "asc" } },
      services: { include: { service: true } },
      materialLines: { include: { article: true, reservations: true } },
      appointments: { include: { employee: { include: { user: true } } } },
    },
  });
}
