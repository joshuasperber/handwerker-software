import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

export async function GET() {
  const auth = await requireAuth("inventory.read");
  if (auth instanceof Response) return auth;

  const locations = await prisma.storageLocation.findMany({
    where: { tenantId: auth.tenantId, isActive: true },
    include: {
      stockBalances: { include: { article: true } },
      vehicle: true,
    },
    orderBy: { name: "asc" },
  });

  return apiSuccess(
    locations.map((l) => ({
      id: l.id,
      name: l.name,
      locationType: l.locationType,
      description: l.description,
      vehicle: l.vehicle,
      articleCount: l.stockBalances.length,
      totalOnHand: l.stockBalances.reduce((s, b) => s + b.onHandQuantity, 0),
    }))
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("inventory.write");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  if (!body.name) return apiError("Name fehlt", 400);

  const location = await prisma.storageLocation.create({
    data: {
      tenantId: auth.tenantId,
      name: body.name,
      locationType: body.locationType ?? "BAUSTELLE",
      description: body.description,
    },
  });

  return apiSuccess(location, 201);
}
