import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.assign");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();

  const team = await prisma.team.findFirst({ where: { id, tenantId: auth.tenantId } });
  if (!team) return apiError("Team nicht gefunden", 404);

  if (body.memberIds) {
    await prisma.teamMember.deleteMany({ where: { teamId: id } });
    if (body.memberIds.length) {
      await prisma.teamMember.createMany({
        data: body.memberIds.map((employeeId: string, i: number) => ({
          teamId: id,
          employeeId,
          isForeman: i === 0,
        })),
      });
    }
  }

  const updated = await prisma.team.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.vehicleId !== undefined ? { vehicleId: body.vehicleId || null } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
    include: {
      members: { include: { employee: { include: { user: true } } } },
      vehicle: true,
    },
  });

  return apiSuccess(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.assign");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  await prisma.team.updateMany({
    where: { id, tenantId: auth.tenantId },
    data: { isActive: false },
  });
  return apiSuccess({ deactivated: true });
}
