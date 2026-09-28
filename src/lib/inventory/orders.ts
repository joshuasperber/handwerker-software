import { prisma } from "@/lib/prisma";
import { calcAvailableQuantity } from "./formulas";
import { articlePriceForCalculation } from "./units";
import { standardPhaseCreateData } from "@/lib/orders/phases";
import type { MaterialOrderStatus, OrderType, ReservationStatus } from "@/generated/prisma/client";
import type { OrderMaterialLineInput } from "@/lib/orders/material-lines";
import { resolveOrderTypeAssignment } from "@/lib/orders/order-types";
import { determineMaterialOrderStatus } from "./order-material-status";

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
    select: { articleId: true, quantityRequired: true },
  });

  if (!lines.length) return "NOT_CHECKED";

  const articleIds = [
    ...new Set(lines.flatMap((line) => (line.articleId ? [line.articleId] : []))),
  ];
  const balances = articleIds.length
    ? await prisma.stockBalance.findMany({
        where: {
          articleId: { in: articleIds },
          article: { tenantId },
        },
        select: {
          articleId: true,
          onHandQuantity: true,
          reservedQuantity: true,
        },
      })
    : [];
  const totals = new Map<string, { onHand: number; reserved: number }>();
  for (const balance of balances) {
    const current = totals.get(balance.articleId) ?? { onHand: 0, reserved: 0 };
    current.onHand += balance.onHandQuantity;
    current.reserved += balance.reservedQuantity;
    totals.set(balance.articleId, current);
  }
  const availableByArticle = new Map(
    [...totals].map(([articleId, total]) => [
      articleId,
      calcAvailableQuantity(total.onHand, total.reserved),
    ])
  );
  const status = determineMaterialOrderStatus(lines, availableByArticle);

  await Promise.all([
    prisma.order.update({
      where: { id: orderId },
      data: { materialStatus: status },
    }),
    prisma.orderMaterialLine.updateMany({
      where: { orderId, isTool: false },
      data: { lineStatus: status === "COMPLETE" ? "COMPLETE" : status },
    }),
  ]);

  return status;
}

export async function confirmReservationsForOrder(orderId: string, tenantId: string) {
  const [mainLocation, lines] = await Promise.all([
    prisma.storageLocation.findFirst({
      where: { tenantId, locationType: "HAUPTLAGER", isActive: true },
    }),
    prisma.orderMaterialLine.findMany({
      where: { orderId, isTool: false, articleId: { not: null } },
    }),
  ]);
  if (!mainLocation) throw new Error("Kein Hauptlager angelegt");

  const articleIds = [
    ...new Set(lines.flatMap((line) => (line.articleId ? [line.articleId] : []))),
  ];
  const balances = await prisma.stockBalance.findMany({
    where: {
      storageLocationId: mainLocation.id,
      articleId: { in: articleIds },
    },
  });
  const balanceByArticle = new Map(balances.map((balance) => [balance.articleId, balance]));
  const remainingByArticle = new Map(
    balances.map((balance) => [
      balance.articleId,
      calcAvailableQuantity(balance.onHandQuantity, balance.reservedQuantity),
    ])
  );
  const reservations: {
    tenantId: string;
    orderId: string;
    orderMaterialLineId: string;
    articleId: string;
    storageLocationId: string;
    quantity: number;
    status: ReservationStatus;
  }[] = [];
  const reservedByArticle = new Map<string, number>();

  for (const line of lines) {
    if (!line.articleId) continue;
    const available = remainingByArticle.get(line.articleId) ?? 0;
    const qty = Math.min(line.quantityRequired, available);
    if (qty <= 0) continue;
    remainingByArticle.set(line.articleId, available - qty);
    reservedByArticle.set(
      line.articleId,
      (reservedByArticle.get(line.articleId) ?? 0) + qty
    );
    reservations.push({
      tenantId,
      orderId,
      orderMaterialLineId: line.id,
      articleId: line.articleId,
      storageLocationId: mainLocation.id,
      quantity: qty,
      status: "RESERVIERT" as ReservationStatus,
    });
  }

  if (reservations.length) {
    await prisma.$transaction([
      prisma.reservation.createMany({ data: reservations }),
      ...[...reservedByArticle].map(([articleId, quantity]) => {
        const balance = balanceByArticle.get(articleId);
        return prisma.stockBalance.upsert({
          where: {
            articleId_storageLocationId: {
              articleId,
              storageLocationId: mainLocation.id,
            },
          },
          create: {
            articleId,
            storageLocationId: mainLocation.id,
            onHandQuantity: balance?.onHandQuantity ?? 0,
            reservedQuantity: quantity,
          },
          update: { reservedQuantity: { increment: quantity } },
        });
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
    /** Optional: Auftrag einem bestehenden Projekt zuordnen */
    projectId?: string | null;
    /** Ein oder mehrere Mitarbeiter (Mehrfachzuweisung). */
    employeeIds?: string[];
    /** @deprecated Nutze employeeIds */
    employeeId?: string;
    scheduledStart?: string;
    scheduledEnd?: string;
    priority?: string;
    confirmMaterial?: boolean;
    /** Wenn gesetzt (auch leeres Array): ersetzt die automatische Stücklisten-Erzeugung. */
    materialLines?: OrderMaterialLineInput[];
    useFixedPrice?: boolean;
    fixedPriceNet?: number | null;
    fixedPriceLabel?: string | null;
    fixedPriceDisplayMode?: string | null;
  }
) {
  const { normalizeFixedPriceFields, suggestFixedPriceLabel } = await import(
    "@/lib/calculation/fixed-price"
  );
  const fixedPrice = normalizeFixedPriceFields({
    useFixedPrice: data.useFixedPrice,
    fixedPriceNet: data.fixedPriceNet,
    fixedPriceLabel: data.fixedPriceLabel,
    fixedPriceDisplayMode: data.fixedPriceDisplayMode,
    fallbackLabel: suggestFixedPriceLabel(data.title),
  });
  if ("error" in fixedPrice) {
    throw new Error(fixedPrice.error);
  }
  const { generateOrderNumber } = await import("@/lib/utils");

  const projectId: string | null = data.projectId?.trim() || null;
  const [typeAssignment, project] = await Promise.all([
    resolveOrderTypeAssignment(tenantId, {
      orderTypeId: data.orderTypeId,
      orderTypeCustom: data.orderTypeCustom,
      orderType: data.orderType,
    }),
    projectId
      ? prisma.project.findFirst({
          where: { id: projectId, tenantId },
          select: { id: true, customerId: true, status: true },
        })
      : Promise.resolve(null),
  ]);
  if ("error" in typeAssignment) {
    throw new Error(typeAssignment.error);
  }

  if (projectId) {
    if (!project) throw new Error("Projekt nicht gefunden");
    if (project.customerId !== data.customerId) {
      throw new Error("Projekt gehört zu einem anderen Kunden");
    }
    if (project.status === "STORNIERT") {
      throw new Error("Storniertes Projekt kann nicht zugeordnet werden");
    }
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

  const toolTemplatesPromise = data.materialLines
    ? prisma.serviceMaterialTemplate.findMany({
        where: { serviceId: { in: data.serviceIds }, isTool: true },
        select: {
          serviceId: true,
          articleId: true,
          name: true,
          defaultQuantity: true,
          unit: true,
          article: { select: { name: true } },
        },
      })
    : null;

  const [order, toolTemplates] = await Promise.all([
    prisma.order.create({
      data: {
        tenantId,
        customerId: data.customerId,
        propertyId: data.propertyId,
        projectId,
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
        useFixedPrice: fixedPrice.useFixedPrice,
        fixedPriceNet: fixedPrice.fixedPriceNet,
        fixedPriceLabel: fixedPrice.fixedPriceLabel,
        fixedPriceDisplayMode: fixedPrice.fixedPriceDisplayMode,
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
      select: { id: true },
    }),
    toolTemplatesPromise ?? Promise.resolve([]),
  ]);

  const materialSetupPromise = (async () => {
    if (data.materialLines) {
      const creates = [
        ...data.materialLines
          .filter((line) => line.name?.trim() && line.quantityRequired > 0)
          .map((line) => ({
            orderId: order.id,
            articleId: line.articleId || null,
            sourceServiceId: line.sourceServiceId || null,
            name: line.name.trim(),
            quantityRequired: line.quantityRequired,
            unit: line.unit?.trim() || "Stück",
            unitPriceNet: line.unitPriceNet ?? null,
            notes: line.notes ?? null,
            isTool: line.isTool === true,
            lineStatus: "NOT_CHECKED" as MaterialOrderStatus,
          })),
        ...toolTemplates.map((template) => ({
          orderId: order.id,
          articleId: template.articleId,
          sourceServiceId: template.serviceId,
          name: template.article?.name ?? template.name,
          quantityRequired: template.defaultQuantity,
          unit: template.unit,
          unitPriceNet: null,
          notes: null,
          isTool: true,
          lineStatus: "NOT_CHECKED" as MaterialOrderStatus,
        })),
      ];
      if (creates.length) {
        await prisma.orderMaterialLine.createMany({ data: creates });
      }
      return;
    }
    await generateMaterialLinesFromServices(order.id, data.serviceIds);
  })();

  // Sobald ein Termin gesetzt ist, wird ein Kalendereintrag erzeugt – auch ohne
  // zugewiesenen Monteur. So erscheint der Auftrag direkt im Team-Kalender und
  // kann später per Drag-and-drop einem Mitarbeiter zugeordnet werden.
  const employeeIds = [
    ...new Set(
      [
        ...(data.employeeIds ?? []),
        ...(data.employeeId ? [data.employeeId] : []),
      ].filter(Boolean)
    ),
  ] as string[];

  const start = data.scheduledStart ? new Date(data.scheduledStart) : null;
  const end = data.scheduledEnd
    ? new Date(data.scheduledEnd)
    : start
      ? new Date(start.getTime() + 2 * 60 * 60 * 1000)
      : null;

  let assignmentPromise: Promise<unknown>;
  if (employeeIds.length) {
    assignmentPromise = Promise.all([
      prisma.orderAssignee.createMany({
        data: employeeIds.map((employeeId) => ({ orderId: order.id, employeeId })),
      }),
      start && end
        ? prisma.appointment.createMany({
            data: employeeIds.map((employeeId) => ({
              tenantId,
              orderId: order.id,
              employeeId,
              startTime: start,
              endTime: end,
              status: "GEPLANT" as const,
            })),
          })
        : Promise.resolve(),
    ]);
  } else if (start && end) {
    assignmentPromise = prisma.appointment.create({
      data: { tenantId, orderId: order.id, employeeId: null, startTime: start, endTime: end, status: "GEPLANT" },
    });
  } else {
    assignmentPromise = Promise.resolve();
  }

  await materialSetupPromise;
  await Promise.all([
    data.confirmMaterial
      ? confirmReservationsForOrder(order.id, tenantId)
      : checkOrderMaterialStatus(order.id, tenantId),
    assignmentPromise,
  ]);

  // Bei Festpreis sofort Kalkulation anlegen (Positionen bleiben intern erhalten).
  if (fixedPrice.useFixedPrice) {
    const { createCalculationFromOrder } = await import("@/lib/calculation/build-from-order");
    await createCalculationFromOrder(tenantId, order.id);
  }

  return { id: order.id };
}
