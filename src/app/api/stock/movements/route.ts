import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("inventory.read");
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const articleId = searchParams.get("articleId");
  const locationId = searchParams.get("locationId");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);

  const movements = await prisma.stockMovement.findMany({
    where: {
      tenantId: auth.tenantId,
      ...(articleId ? { articleId } : {}),
      ...(locationId ? { storageLocationId: locationId } : {}),
    },
    include: {
      article: { select: { name: true, unit: true } },
      storageLocation: { select: { name: true, locationType: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return apiSuccess(movements);
}
