import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

async function validateTeamMembers(tenantId: string, memberIds: string[]) {
  if (!memberIds.length) return null;
  const count = await prisma.employee.count({
    where: { id: { in: memberIds }, tenantId },
  });
  if (count !== memberIds.length) return "Ein oder mehrere Mitarbeiter gehören nicht zum Betrieb";
  return null;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "1";

  const teams = await prisma.team.findMany({
    where: { tenantId: auth.tenantId, ...(includeInactive ? {} : { isActive: true }) },
    include: {
      members: { include: { employee: { include: { user: true } } } },
      vehicle: true,
      _count: { select: { orders: true } },
    },
    orderBy: { name: "asc" },
  });

  return apiSuccess(teams);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("orders.assign");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  if (!body.name) return apiError("Name fehlt", 400);

  const memberIds: string[] = Array.isArray(body.memberIds) ? body.memberIds : [];
  const memberError = await validateTeamMembers(auth.tenantId, memberIds);
  if (memberError) return apiError(memberError, 404);

  if (body.vehicleId) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: body.vehicleId, tenantId: auth.tenantId },
    });
    if (!vehicle) return apiError("Fahrzeug nicht gefunden", 404);
  }

  const team = await prisma.team.create({
    data: {
      tenantId: auth.tenantId,
      name: body.name,
      vehicleId: body.vehicleId,
      members: body.memberIds?.length
        ? {
            create: body.memberIds.map((employeeId: string, i: number) => ({
              employeeId,
              isForeman: i === 0,
            })),
          }
        : undefined,
    },
    include: { members: { include: { employee: { include: { user: true } } } } },
  });

  return apiSuccess(team, 201);
}
