import { NextRequest } from "next/server";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { bookOrderConsumption } from "@/lib/inventory/consumption";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("inventory.write");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;
  const body = await request.json();
  const lines = body.lines as { lineId: string; quantityConsumed: number; returned?: number }[];

  if (!lines?.length) return apiError("lines erforderlich", 400);

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId: auth.tenantId },
  });
  if (!order) return apiError("Auftrag nicht gefunden", 404);

  const status = await bookOrderConsumption({
    tenantId: auth.tenantId,
    orderId,
    lines,
  });

  return apiSuccess({ materialStatus: status });
}
