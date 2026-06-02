import { prisma } from "@/lib/prisma";
import { calcAvailableQuantity, PHASE_TEMPLATES } from "./formulas";
import type { MaterialOrderStatus, OrderPhaseType, OrderType, ReservationStatus } from "@/generated/prisma/client";

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

export function defaultPhasesForOrderType(orderType: OrderType) {
  const key = orderType in PHASE_TEMPLATES ? orderType : "DEFAULT";
  const template = PHASE_TEMPLATES[key] ?? PHASE_TEMPLATES.DEFAULT;
  return template.map((p, i) => ({
    name: p.name,
    phaseType: p.phaseType as OrderPhaseType,
    sortOrder: i,
    status: "AUSSTEHEND" as const,
  }));
}

export async function createOrderWithWizardData(
  tenantId: string,
  data: {
    customerId: string;
    propertyId: string;
    title: string;
    orderType: OrderType;
    description?: string;
    internalNotes?: string;
    serviceIds: string[];
    employeeId?: string;
    scheduledStart?: string;
    scheduledEnd?: string;
    priority?: string;
    confirmMaterial?: boolean;
  }
) {
  const { generateOrderNumber } = await import("@/lib/utils");

  const order = await prisma.order.create({
    data: {
      tenantId,
      customerId: data.customerId,
      propertyId: data.propertyId,
      orderNumber: generateOrderNumber(),
      title: data.title,
      orderType: data.orderType,
      description: data.description,
      internalNotes: data.internalNotes,
      priority: (data.priority as never) ?? "NORMAL",
      status: data.scheduledStart ? "EINGEPLANT" : "NEUE_ANFRAGE",
      scheduledStart: data.scheduledStart ? new Date(data.scheduledStart) : undefined,
      scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd) : undefined,
      services: {
        create: data.serviceIds.map((serviceId) => ({ serviceId })),
      },
      phases: {
        create: defaultPhasesForOrderType(data.orderType),
      },
    },
    include: {
      customer: true,
      property: true,
      phases: true,
      services: { include: { service: true } },
    },
  });

  await generateMaterialLinesFromServices(order.id, data.serviceIds);
  await checkOrderMaterialStatus(order.id, tenantId);

  if (data.confirmMaterial) {
    await confirmReservationsForOrder(order.id, tenantId);
  }

  if (data.employeeId && data.scheduledStart && data.scheduledEnd) {
    await prisma.appointment.create({
      data: {
        tenantId,
        orderId: order.id,
        employeeId: data.employeeId,
        startTime: new Date(data.scheduledStart),
        endTime: new Date(data.scheduledEnd),
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
