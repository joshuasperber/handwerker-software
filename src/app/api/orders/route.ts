import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { parseBody } from "@/lib/api-body";
import { createOrderSchema } from "@/lib/schemas/orders";
import { standardPhaseCreateData } from "@/lib/orders/phases";
import { validateOrderCreateRefs } from "@/lib/tenant-scope";
import { ORDER_LIST_INCLUDE } from "@/lib/orders/includes";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  const orders = await prisma.order.findMany({
    where: {
      tenantId: auth.tenantId,
      ...(status ? { status: status as never } : {}),
      ...(search
        ? {
            OR: [
              { orderNumber: { contains: search, mode: "insensitive" } },
              { customer: { firstName: { contains: search, mode: "insensitive" } } },
              { customer: { lastName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: ORDER_LIST_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return apiSuccess(orders);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const body = await parseBody(request, createOrderSchema);
  if (body instanceof Response) return body;

  const refError = await validateOrderCreateRefs(auth.tenantId, {
    customerId: body.customerId,
    propertyId: body.propertyId,
    serviceIds: body.serviceIds,
  });
  if (refError) return apiError(refError, 404);

  const { generateOrderNumber } = await import("@/lib/utils");
  const order = await prisma.order.create({
    data: {
      tenantId: auth.tenantId,
      customerId: body.customerId,
      propertyId: body.propertyId,
      orderNumber: generateOrderNumber(),
      status: "NEUE_ANFRAGE",
      description: body.description,
      internalNotes: body.internalNotes,
      services: { create: body.serviceIds.map((serviceId) => ({ serviceId })) },
      phases: {
        create: standardPhaseCreateData(),
      },
    },
    include: ORDER_LIST_INCLUDE,
  });

  return apiSuccess(order, 201);
}
