import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError, getClientIp } from "@/lib/api";
import { auditOrderStatusChange, auditEntityChange } from "@/lib/audit";
import { notifyStatusChange } from "@/lib/notifications";
import { syncTeamAppointmentsForOrder } from "@/lib/team-appointments";
import { ORDER_DETAIL_INCLUDE } from "@/lib/orders/includes";
import { validateOrderCreateRefs } from "@/lib/tenant-scope";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const { id } = await params;

  try {
    const order = await prisma.order.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: ORDER_DETAIL_INCLUDE,
    });

    if (!order) return apiError("Auftrag nicht gefunden", 404);

    const { canViewEmployeeWages } = await import("@/lib/employees/wage-access");
    if (!canViewEmployeeWages(auth.role)) {
      return apiSuccess({
        ...order,
        timeEntries: order.timeEntries.map((t) => ({
          ...t,
          employee: {
            ...t.employee,
            hourlyWageNet: null,
            billingHourlyRateNet: null,
          },
        })),
      });
    }

    return apiSuccess(order);
  } catch (err) {
    console.error("[orders/[id] GET]", err);
    return apiError("Auftrag konnte nicht geladen werden", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();
  const ip = getClientIp(request);

  const existing = await prisma.order.findFirst({
    where: { id, tenantId: auth.tenantId },
    select: {
      id: true,
      orderNumber: true,
      customerId: true,
      propertyId: true,
      projectId: true,
      title: true,
      status: true,
      teamId: true,
      scheduledStart: true,
      scheduledEnd: true,
      orderType: true,
      orderTypeId: true,
      orderTypeLabel: true,
      orderTypeCustom: true,
      useFixedPrice: true,
      fixedPriceNet: true,
      fixedPriceLabel: true,
      fixedPriceDisplayMode: true,
      customer: { select: { email: true } },
      services: {
        select: {
          serviceId: true,
          customName: true,
          description: true,
          quantity: true,
          unitPriceCents: true,
          notes: true,
        },
      },
    },
  });

  if (!existing) return apiError("Auftrag nicht gefunden", 404);

  const {
    status,
    priority,
    description,
    internalNotes,
    scheduledStart,
    scheduledEnd,
    teamId,
    vehicleId,
    completionResult,
    customerConfirmationStatus,
    orderTypeId,
    orderTypeCustom,
    title,
    projectId,
    useFixedPrice,
    fixedPriceNet,
    fixedPriceLabel,
    fixedPriceDisplayMode,
    ensureCalculation,
    customerId,
    propertyId,
    serviceIds: rawServiceIds,
    customServices: rawCustomServices,
  } = body;

  if (title !== undefined && (typeof title !== "string" || !title.trim())) {
    return apiError("Auftragstitel ist erforderlich", 400);
  }
  if (customerId !== undefined && (typeof customerId !== "string" || !customerId)) {
    return apiError("Kunde ist erforderlich", 400);
  }
  if (propertyId !== undefined && (typeof propertyId !== "string" || !propertyId)) {
    return apiError("Ausführungsadresse ist erforderlich", 400);
  }

  const serviceIdsProvided = rawServiceIds !== undefined;
  if (serviceIdsProvided && !Array.isArray(rawServiceIds)) {
    return apiError("Leistungen müssen als Liste übermittelt werden", 400);
  }
  const serviceIds: string[] = serviceIdsProvided
    ? [
        ...new Set<string>(
          (rawServiceIds as unknown[]).filter(
            (serviceId: unknown): serviceId is string =>
              typeof serviceId === "string" && serviceId.length > 0
          )
        ),
      ]
    : existing.services.flatMap((entry) => entry.serviceId ? [entry.serviceId] : []);
  const customServicesProvided = rawCustomServices !== undefined;
  if (customServicesProvided && !Array.isArray(rawCustomServices)) {
    return apiError("Zusätzliche Leistungen müssen als Liste übermittelt werden", 400);
  }
  const customServices = customServicesProvided
    ? rawCustomServices.flatMap((entry: unknown) => {
        if (!entry || typeof entry !== "object") return [];
        const value = entry as Record<string, unknown>;
        const name = typeof value.name === "string" ? value.name.trim() : "";
        if (!name) return [];
        const quantity = Number(value.quantity ?? 1);
        const price = value.unitPriceCents == null || value.unitPriceCents === ""
          ? null
          : Number(value.unitPriceCents);
        if (!Number.isInteger(quantity) || quantity <= 0) return [];
        if (price !== null && (!Number.isFinite(price) || price < 0)) return [];
        return [{
          customName: name,
          description:
            typeof value.description === "string" && value.description.trim()
              ? value.description.trim()
              : null,
          quantity,
          unitPriceCents: price === null ? null : Math.round(price),
          notes:
            typeof value.notes === "string" && value.notes.trim()
              ? value.notes.trim()
              : null,
        }];
      })
    : existing.services.flatMap((entry) => entry.serviceId ? [] : [{
        customName: entry.customName ?? "",
        description: entry.description,
        quantity: entry.quantity,
        unitPriceCents: entry.unitPriceCents,
        notes: entry.notes,
      }]);
  const submittedCustomServiceCount = customServicesProvided
    ? (rawCustomServices as unknown[]).filter((entry) => {
        if (!entry || typeof entry !== "object") return false;
        const name = (entry as Record<string, unknown>).name;
        return typeof name === "string" && name.trim().length > 0;
      }).length
    : customServices.length;
  if (customServicesProvided && submittedCustomServiceCount !== customServices.length) {
    return apiError("Menge oder Preis einer zusätzlichen Leistung ist ungültig", 400);
  }

  const nextCustomerId =
    typeof customerId === "string" && customerId ? customerId : existing.customerId;
  const nextPropertyId =
    typeof propertyId === "string" && propertyId ? propertyId : existing.propertyId;

  if (
    customerId !== undefined ||
    propertyId !== undefined ||
    serviceIdsProvided ||
    customServicesProvided
  ) {
    if (!nextCustomerId || !nextPropertyId) {
      return apiError("Kunde und Ausführungsadresse sind erforderlich", 400);
    }
    const refError = await validateOrderCreateRefs(auth.tenantId, {
      customerId: nextCustomerId,
      propertyId: nextPropertyId,
      serviceIds,
    });
    if (refError) return apiError(refError, 404);
  }

  if (
    (serviceIdsProvided || customServicesProvided) &&
    serviceIds.length === 0 &&
    customServices.length === 0
  ) {
    return apiError("Mindestens eine Leistung ist erforderlich", 400);
  }

  function parseOptionalDate(value: unknown, current: Date | null) {
    if (value === undefined) return current;
    if (value === null || value === "") return null;
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  const nextScheduledStart = parseOptionalDate(scheduledStart, existing.scheduledStart);
  const nextScheduledEnd = parseOptionalDate(scheduledEnd, existing.scheduledEnd);
  if (scheduledStart !== undefined && nextScheduledStart === undefined) {
    return apiError("Ungültiger Terminbeginn", 400);
  }
  if (scheduledEnd !== undefined && nextScheduledEnd === undefined) {
    return apiError("Ungültiges Terminende", 400);
  }
  if (nextScheduledStart && nextScheduledEnd && nextScheduledEnd <= nextScheduledStart) {
    return apiError("Das Terminende muss nach dem Beginn liegen", 400);
  }

  const currentServices = [
    ...existing.services.flatMap((entry) => entry.serviceId ? [`catalog:${entry.serviceId}`] : []),
    ...existing.services.flatMap((entry) => entry.serviceId ? [] : [
      `custom:${entry.customName ?? ""}:${entry.description ?? ""}:${entry.quantity}:${entry.unitPriceCents ?? ""}:${entry.notes ?? ""}`,
    ]),
  ].toSorted();
  const nextServices = [
    ...serviceIds.map((serviceId) => `catalog:${serviceId}`),
    ...customServices.map((entry: {
      customName: string;
      description: string | null;
      quantity: number;
      unitPriceCents: number | null;
      notes: string | null;
    }) =>
      `custom:${entry.customName}:${entry.description ?? ""}:${entry.quantity}:${entry.unitPriceCents ?? ""}:${entry.notes ?? ""}`
    ),
  ].toSorted();
  const servicesChanged = (serviceIdsProvided || customServicesProvided) &&
    (currentServices.length !== nextServices.length ||
      currentServices.some((service, index) => service !== nextServices[index]));

  let typePatch: {
    orderType?: typeof existing.orderType;
    orderTypeId?: string | null;
    orderTypeLabel?: string | null;
    orderTypeCustom?: string | null;
  } = {};

  if (orderTypeId !== undefined || orderTypeCustom !== undefined) {
    const { resolveOrderTypeAssignment } = await import("@/lib/orders/order-types");
    const nextId = orderTypeId ?? existing.orderTypeId;
    const assignment = await resolveOrderTypeAssignment(auth.tenantId, {
      orderTypeId: nextId,
      orderTypeCustom:
        orderTypeCustom !== undefined ? orderTypeCustom : existing.orderTypeCustom,
      orderType: existing.orderType,
      allowInactive: nextId === existing.orderTypeId,
    });
    if ("error" in assignment) return apiError(assignment.error, 400);
    typePatch = {
      orderType: assignment.orderType,
      orderTypeId: assignment.orderTypeId,
      // Snapshot nur aktualisieren, wenn der Typ gewechselt wurde – Historie bei Umbenennung bleibt.
      orderTypeLabel:
        nextId === existing.orderTypeId && existing.orderTypeLabel
          ? existing.orderTypeLabel
          : assignment.orderTypeLabel,
      orderTypeCustom: assignment.orderTypeCustom,
    };
  }

  let nextProjectId: string | null | undefined = undefined;
  if (projectId !== undefined) {
    const raw = typeof projectId === "string" ? projectId.trim() : "";
    if (!raw) {
      nextProjectId = null;
    } else {
      const project = await prisma.project.findFirst({
        where: { id: raw, tenantId: auth.tenantId },
        select: { id: true, customerId: true, status: true },
      });
      if (!project) return apiError("Projekt nicht gefunden", 404);
      if (project.customerId !== nextCustomerId) {
        return apiError("Projekt gehört zu einem anderen Kunden", 400);
      }
      if (project.status === "STORNIERT") {
        return apiError("Storniertes Projekt kann nicht zugeordnet werden", 400);
      }
      nextProjectId = project.id;
    }
  }

  let fixedPricePatch: {
    useFixedPrice?: boolean;
    fixedPriceNet?: number | null;
    fixedPriceLabel?: string | null;
    fixedPriceDisplayMode?: "SINGLE_LINE" | "POSITIONS_WITH_PRICES" | "DESCRIPTION_ONLY";
  } = {};

  if (
    useFixedPrice != null ||
    fixedPriceNet !== undefined ||
    fixedPriceLabel !== undefined ||
    fixedPriceDisplayMode !== undefined
  ) {
    const { normalizeFixedPriceFields, suggestFixedPriceLabel } = await import(
      "@/lib/calculation/fixed-price"
    );
    const normalized = normalizeFixedPriceFields({
      useFixedPrice: useFixedPrice != null ? Boolean(useFixedPrice) : existing.useFixedPrice,
      fixedPriceNet:
        fixedPriceNet === null
          ? null
          : fixedPriceNet !== undefined
            ? Number(fixedPriceNet)
            : existing.fixedPriceNet,
      fixedPriceLabel:
        fixedPriceLabel === null
          ? null
          : fixedPriceLabel !== undefined
            ? String(fixedPriceLabel)
            : existing.fixedPriceLabel,
      fixedPriceDisplayMode:
        fixedPriceDisplayMode !== undefined
          ? String(fixedPriceDisplayMode)
          : existing.fixedPriceDisplayMode,
      fallbackLabel: suggestFixedPriceLabel(title ?? existing.title),
    });
    if ("error" in normalized) return apiError(normalized.error, 400);
    fixedPricePatch = normalized;
  }

  const order = await prisma.order.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(title !== undefined ? { title: title.trim() } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(internalNotes !== undefined ? { internalNotes } : {}),
      ...(scheduledStart !== undefined ? { scheduledStart: nextScheduledStart } : {}),
      ...(scheduledEnd !== undefined ? { scheduledEnd: nextScheduledEnd } : {}),
      ...(customerId !== undefined ? { customerId: nextCustomerId } : {}),
      ...(propertyId !== undefined ? { propertyId: nextPropertyId } : {}),
      ...(customerId !== undefined && nextCustomerId !== existing.customerId && projectId === undefined
        ? { projectId: null }
        : {}),
      ...(servicesChanged
        ? {
            services: {
              deleteMany: {},
              create: [
                ...serviceIds.map((serviceId) => ({ serviceId })),
                ...customServices,
              ],
            },
          }
        : {}),
      ...(teamId !== undefined ? { teamId: teamId || null } : {}),
      ...(vehicleId !== undefined ? { vehicleId: vehicleId || null } : {}),
      ...(completionResult !== undefined ? { completionResult } : {}),
      ...(customerConfirmationStatus !== undefined ? { customerConfirmationStatus } : {}),
      ...(nextProjectId !== undefined ? { projectId: nextProjectId } : {}),
      ...(status === "ABGESCHLOSSEN" || status === "ABRECHNUNGSBEREIT" ? { completedAt: new Date() } : {}),
      ...(status === "ABGERECHNET" ? { invoicedAt: new Date() } : {}),
      ...typePatch,
      ...fixedPricePatch,
    },
  });

  if (Object.keys(fixedPricePatch).length > 0) {
    const { syncFixedPriceToOrderCalculation } = await import(
      "@/lib/calculation/sync-fixed-price"
    );
    const { createCalculationFromOrder } = await import("@/lib/calculation/build-from-order");
    let synced = await syncFixedPriceToOrderCalculation(
      auth.tenantId,
      id,
      fixedPricePatch as {
        useFixedPrice: boolean;
        fixedPriceNet: number | null;
        fixedPriceLabel: string | null;
        fixedPriceDisplayMode: "SINGLE_LINE" | "POSITIONS_WITH_PRICES" | "DESCRIPTION_ONLY";
      }
    );
    if (!synced && ensureCalculation && fixedPricePatch.useFixedPrice) {
      const created = await createCalculationFromOrder(auth.tenantId, id);
      synced = created.calculation.id;
      await syncFixedPriceToOrderCalculation(
        auth.tenantId,
        id,
        fixedPricePatch as {
          useFixedPrice: boolean;
          fixedPriceNet: number | null;
          fixedPriceLabel: string | null;
          fixedPriceDisplayMode: "SINGLE_LINE" | "POSITIONS_WITH_PRICES" | "DESCRIPTION_ONLY";
        }
      );
    }
  }

  if (status && status !== existing.status) {
    await auditOrderStatusChange(auth, id, existing.status, status, ip);
    await notifyStatusChange(
      auth.tenantId,
      existing.customer.email,
      existing.orderNumber,
      status
    );
  } else {
    await auditEntityChange(auth, "Order", id, "UPDATE", existing, body, ip);
  }

  if (teamId !== undefined && teamId) {
    await syncTeamAppointmentsForOrder(auth.tenantId, id);
  }
  if ((scheduledStart || scheduledEnd) && existing.teamId) {
    await syncTeamAppointmentsForOrder(auth.tenantId, id);
  }

  return apiSuccess(order);
}
