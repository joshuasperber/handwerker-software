import { NextRequest } from "next/server";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { createOrderWithWizardData } from "@/lib/inventory/orders";
import type { OrderType } from "@/generated/prisma/client";

export async function POST(request: NextRequest) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const {
    customerId,
    propertyId,
    title,
    orderType,
    description,
    internalNotes,
    serviceIds,
    customServices,
    employeeId,
    scheduledStart,
    scheduledEnd,
    priority,
    confirmMaterial,
  } = body;

  const hasCatalog = Array.isArray(serviceIds) && serviceIds.length > 0;
  const hasCustom =
    Array.isArray(customServices) &&
    customServices.some((c: { name?: string }) => c?.name?.trim());

  if (!customerId || !propertyId || !title || (!hasCatalog && !hasCustom)) {
    return apiError("Kunde, Objekt, Titel und mindestens eine Leistung sind Pflicht", 400);
  }

  const order = await createOrderWithWizardData(auth.tenantId, {
    customerId,
    propertyId,
    title,
    orderType: (orderType ?? "REPARATUR") as OrderType,
    description,
    internalNotes,
    serviceIds: serviceIds ?? [],
    customServices,
    employeeId,
    scheduledStart,
    scheduledEnd,
    priority,
    confirmMaterial: Boolean(confirmMaterial),
  });

  return apiSuccess(order, 201);
}
