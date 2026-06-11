import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

const VEHICLE_INCLUDE = {
  storageLocation: true,
  teams: { select: { id: true, name: true } },
  assignedEmployee: { include: { user: { select: { firstName: true, lastName: true } } } },
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.assign");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();

  const vehicle = await prisma.vehicle.findFirst({ where: { id, tenantId: auth.tenantId } });
  if (!vehicle) return apiError("Fahrzeug nicht gefunden", 404);

  const updated = await prisma.vehicle.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.licensePlate !== undefined ? { licensePlate: body.licensePlate || null } : {}),
      ...(body.vehicleType !== undefined ? { vehicleType: body.vehicleType || null } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
      ...(body.assignedEmployeeId !== undefined
        ? { assignedEmployeeId: body.assignedEmployeeId || null }
        : {}),
      ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
    },
    include: VEHICLE_INCLUDE,
  });

  // Lagerort-Name mit Fahrzeugnamen synchron halten.
  if (body.name !== undefined && vehicle.storageLocationId) {
    await prisma.storageLocation.update({
      where: { id: vehicle.storageLocationId },
      data: { name: body.name },
    });
  }

  return apiSuccess(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.assign");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const hard = searchParams.get("hard") === "1";

  const vehicle = await prisma.vehicle.findFirst({ where: { id, tenantId: auth.tenantId } });
  if (!vehicle) return apiError("Fahrzeug nicht gefunden", 404);

  if (hard) {
    // Harte Löschung nur möglich, wenn keine Aufträge daran hängen.
    const orderCount = await prisma.order.count({ where: { vehicleId: id } });
    if (orderCount > 0) {
      return apiError(
        "Fahrzeug ist Aufträgen zugewiesen und kann nur deaktiviert werden",
        400
      );
    }
    await prisma.team.updateMany({ where: { vehicleId: id }, data: { vehicleId: null } });
    await prisma.vehicle.delete({ where: { id } });
    if (vehicle.storageLocationId) {
      await prisma.storageLocation
        .delete({ where: { id: vehicle.storageLocationId } })
        .catch(() => undefined);
    }
    return apiSuccess({ deleted: true });
  }

  await prisma.vehicle.update({
    where: { id },
    data: { isActive: false, status: "INAKTIV" },
  });
  return apiSuccess({ deactivated: true });
}
