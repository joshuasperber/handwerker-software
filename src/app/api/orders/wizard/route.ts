import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
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
    employeeId,
    scheduledStart,
    scheduledEnd,
    priority,
    confirmMaterial,
  } = body;

  if (!customerId || !propertyId || !title || !serviceIds?.length) {
    return apiError("Kunde, Objekt, Titel und mindestens eine Leistung sind Pflicht", 400);
  }

  const order = await createOrderWithWizardData(auth.tenantId, {
    customerId,
    propertyId,
    title,
    orderType: (orderType ?? "REPARATUR") as OrderType,
    description,
    internalNotes,
    serviceIds,
    employeeId,
    scheduledStart,
    scheduledEnd,
    priority,
    confirmMaterial: Boolean(confirmMaterial),
  });

  return apiSuccess(order, 201);
}
