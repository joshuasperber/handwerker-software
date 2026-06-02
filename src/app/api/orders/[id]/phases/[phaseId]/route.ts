import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const { id, phaseId } = await params;
  const body = await request.json();

  const order = await prisma.order.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!order) return apiError("Auftrag nicht gefunden", 404);

  const phase = await prisma.orderPhase.findFirst({
    where: { id: phaseId, orderId: id },
  });
  if (!phase) return apiError("Phase nicht gefunden", 404);

  const updated = await prisma.orderPhase.update({
    where: { id: phaseId },
    data: {
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.plannedStart ? { plannedStart: new Date(body.plannedStart) } : {}),
      ...(body.plannedEnd ? { plannedEnd: new Date(body.plannedEnd) } : {}),
    },
  });

  return apiSuccess(updated);
}
