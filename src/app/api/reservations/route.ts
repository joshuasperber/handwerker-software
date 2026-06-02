import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { confirmReservationsForOrder } from "@/lib/inventory/orders";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("inventory.read");
  if (auth instanceof Response) return auth;

  const orderId = request.nextUrl.searchParams.get("orderId");

  const reservations = await prisma.reservation.findMany({
    where: {
      ...(orderId ? { orderId } : {}),
      order: { tenantId: auth.tenantId },
      status: { in: ["VORGESCHLAGEN", "RESERVIERT"] },
    },
    include: {
      article: true,
      storageLocation: true,
      order: { select: { orderNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return apiSuccess(reservations);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("inventory.reserve");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const { orderId } = body;
  if (!orderId) return apiError("orderId fehlt", 400);

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId: auth.tenantId },
  });
  if (!order) return apiError("Auftrag nicht gefunden", 404);

  const status = await confirmReservationsForOrder(orderId, auth.tenantId);

  const updated = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      materialLines: { include: { article: true, reservations: true } },
    },
  });

  return apiSuccess({ order: updated, materialStatus: status });
}
