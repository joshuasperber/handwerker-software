import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

export async function GET() {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const vehicles = await prisma.vehicle.findMany({
    where: { tenantId: auth.tenantId, isActive: true },
    include: {
      storageLocation: {
        include: { stockBalances: { include: { article: true } } },
      },
      teams: true,
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
      licensePlate: body.licensePlate,
      storageLocationId: location.id,
    },
    include: { storageLocation: true },
  });

  return apiSuccess(vehicle, 201);
}
