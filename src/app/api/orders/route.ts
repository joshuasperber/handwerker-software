import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { standardPhaseCreateData } from "@/lib/orders/phases";

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
    include: {
      customer: true,
      property: true,
      services: { include: { service: true } },
      appointments: { include: { employee: { include: { user: true } } } },
      phases: { orderBy: { sortOrder: "asc" } },
      materialLines: { include: { article: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Bestehende Aufträge ohne Phasen erhalten automatisch die Standardphasen,
  // damit die Übersicht für alle Aufträge eine Phase anzeigen kann.
  const ordersWithoutPhases = orders.filter((o) => o.phases.length === 0);
  if (ordersWithoutPhases.length > 0) {
    await prisma.$transaction(
      ordersWithoutPhases.map((o) =>
        prisma.orderPhase.createMany({
          data: standardPhaseCreateData().map((phase) => ({ ...phase, orderId: o.id })),
        })
      )
    );
    const refreshed = await prisma.orderPhase.findMany({
      where: { orderId: { in: ordersWithoutPhases.map((o) => o.id) } },
      orderBy: { sortOrder: "asc" },
    });
    const byOrder = new Map<string, typeof refreshed>();
    for (const phase of refreshed) {
      const list = byOrder.get(phase.orderId) ?? [];
      list.push(phase);
      byOrder.set(phase.orderId, list);
    }
    for (const o of ordersWithoutPhases) {
      o.phases = (byOrder.get(o.id) ?? []) as typeof o.phases;
    }
  }

  return apiSuccess(orders);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const { customerId, propertyId, serviceIds, description, internalNotes } = body;

  if (!customerId || !propertyId || !serviceIds?.length) {
    return apiError("Pflichtfelder fehlen", 400);
  }

  const { generateOrderNumber } = await import("@/lib/utils");
  const order = await prisma.order.create({
    data: {
      tenantId: auth.tenantId,
      customerId,
      propertyId,
      orderNumber: generateOrderNumber(),
      status: "NEUE_ANFRAGE",
      description,
      internalNotes,
      services: { create: serviceIds.map((id: string) => ({ serviceId: id })) },
      phases: {
        create: standardPhaseCreateData(),
      },
    },
    include: {
      customer: true,
      property: true,
      services: { include: { service: true } },
      phases: { orderBy: { sortOrder: "asc" } },
    },
  });

  return apiSuccess(order, 201);
}
