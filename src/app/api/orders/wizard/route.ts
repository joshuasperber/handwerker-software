import { NextRequest } from "next/server";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { createOrderWithWizardData } from "@/lib/inventory/orders";
import { validateOrderCreateRefs } from "@/lib/tenant-scope";

export async function POST(request: NextRequest) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const {
    customerId,
    propertyId,
    projectId,
    title,
    orderTypeId,
    orderTypeCustom,
    orderType,
    description,
    internalNotes,
    serviceIds,
    customServices,
    employeeId,
    employeeIds,
    scheduledStart,
    scheduledEnd,
    priority,
    confirmMaterial,
    materialLines: rawMaterialLines,
  } = body;

  const hasCatalog = Array.isArray(serviceIds) && serviceIds.length > 0;
  const hasCustom =
    Array.isArray(customServices) &&
    customServices.some((c: { name?: string }) => c?.name?.trim());

  if (!customerId || !propertyId || !title || (!hasCatalog && !hasCustom)) {
    return apiError("Kunde, Objekt, Titel und mindestens eine Leistung sind Pflicht", 400);
  }

  const resolvedEmployeeIds = [
    ...new Set(
      [
        ...(Array.isArray(employeeIds) ? employeeIds : []),
        ...(employeeId ? [employeeId] : []),
      ].filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];

  const refError = await validateOrderCreateRefs(auth.tenantId, {
    customerId,
    propertyId,
    serviceIds: serviceIds ?? [],
    employeeIds: resolvedEmployeeIds,
  });
  if (refError) return apiError(refError, 404);

  const { normalizeOrderMaterialLineInput } = await import("@/lib/orders/material-lines");
  const materialLines = Array.isArray(rawMaterialLines)
    ? rawMaterialLines
        .map((l: Record<string, unknown>) => normalizeOrderMaterialLineInput(l))
        .filter((l): l is NonNullable<typeof l> => l != null)
    : undefined;

  try {
    const order = await createOrderWithWizardData(auth.tenantId, {
      customerId,
      propertyId,
      projectId: projectId || null,
      title,
      orderTypeId: orderTypeId || null,
      orderTypeCustom: orderTypeCustom || null,
      orderType: orderType || null,
      description,
      internalNotes,
      serviceIds: serviceIds ?? [],
      customServices,
      employeeIds: resolvedEmployeeIds,
      scheduledStart,
      scheduledEnd,
      priority,
      confirmMaterial: Boolean(confirmMaterial),
      materialLines,
    });
    return apiSuccess(order, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Auftrag konnte nicht angelegt werden";
    return apiError(message, 400);
  }
}
