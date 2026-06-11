import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("includeInactive") === "1";

  const vehicles = await prisma.vehicle.findMany({
    where: { tenantId: auth.tenantId, ...(includeInactive ? {} : { isActive: true }) },
    include: {
      storageLocation: {
        include: { stockBalances: { include: { article: true } } },
      },
      teams: true,
      assignedEmployee: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { name: "asc" },
  });

  return apiSuccess(vehicles);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("orders.assign");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  if (!body.name) return apiError("Name fehlt", 400);

  const location = await prisma.storageLocation.create({
    data: {
      tenantId: auth.tenantId,
      name: body.name,
      locationType: "FAHRZEUG",
    },
  });

  const vehicle = await prisma.vehicle.create({
    data: {
      tenantId: auth.tenantId,
      name: body.name,
      licensePlate: body.licensePlate || null,
      vehicleType: body.vehicleType || null,
      status: body.status ?? "VERFUEGBAR",
      notes: body.notes || null,
      assignedEmployeeId: body.assignedEmployeeId || null,
      storageLocationId: location.id,
    },
    include: {
      storageLocation: true,
      assignedEmployee: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
  });

  return apiSuccess(vehicle, 201);
}
