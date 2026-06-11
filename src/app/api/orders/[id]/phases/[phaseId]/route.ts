import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

const PHASE_INCLUDE = {
  assignedTeam: { select: { id: true, name: true } },
  assignedEmployee: { include: { user: { select: { firstName: true, lastName: true } } } },
  files: { orderBy: { createdAt: "desc" as const } },
};

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
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.isEnabled !== undefined ? { isEnabled: Boolean(body.isEnabled) } : {}),
      ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
      ...(body.specialNotes !== undefined ? { specialNotes: body.specialNotes || null } : {}),
      ...(body.assignedTeamId !== undefined
        ? { assignedTeamId: body.assignedTeamId || null }
        : {}),
      ...(body.assignedEmployeeId !== undefined
        ? { assignedEmployeeId: body.assignedEmployeeId || null }
        : {}),
      ...(body.plannedStart !== undefined
        ? { plannedStart: body.plannedStart ? new Date(body.plannedStart) : null }
        : {}),
      ...(body.plannedEnd !== undefined
        ? { plannedEnd: body.plannedEnd ? new Date(body.plannedEnd) : null }
        : {}),
    },
    include: PHASE_INCLUDE,
  });

  return apiSuccess(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const { id, phaseId } = await params;

  const order = await prisma.order.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!order) return apiError("Auftrag nicht gefunden", 404);

  const phase = await prisma.orderPhase.findFirst({
    where: { id: phaseId, orderId: id },
  });
  if (!phase) return apiError("Phase nicht gefunden", 404);

  await prisma.orderPhase.delete({ where: { id: phaseId } });
  return apiSuccess({ id: phaseId });
}
