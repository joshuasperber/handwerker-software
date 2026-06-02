import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

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

  return apiSuccess(orders);
}

/**
 * Standard-Phasenablauf für jeden neuen Auftrag. Beginnt immer mit der
 * verpflichtenden Voranmeldung/Besichtigung, in der Preis, Ort und mögliche
 * Aufpreise geprüft werden, bevor die eigentliche Ausführung startet.
 */
const DEFAULT_ORDER_PHASES = [
  { name: "Voranmeldung / Besichtigung", phaseType: "BESICHTIGUNG" },
  { name: "Angebot & Kalkulation", phaseType: "PLANUNG" },
  { name: "Materialbestellung", phaseType: "MATERIALBESTELLUNG" },
  { name: "Ausführung", phaseType: "AUSFUEHRUNG_1" },
  { name: "Abnahme", phaseType: "ABNAHME" },
  { name: "Rechnung", phaseType: "RECHNUNG" },
] as const;

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
        create: DEFAULT_ORDER_PHASES.map((p, index) => ({
          name: p.name,
          phaseType: p.phaseType as never,
          status: "AUSSTEHEND",
          sortOrder: index,
        })),
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
