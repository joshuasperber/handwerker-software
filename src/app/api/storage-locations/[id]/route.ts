import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { calcAvailableQuantity } from "@/lib/inventory/formulas";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("inventory.read");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const location = await prisma.storageLocation.findFirst({
    where: { id, tenantId: auth.tenantId, isActive: true },
    include: {
      stockBalances: {
        include: { article: true },
        orderBy: { article: { name: "asc" } },
      },
      vehicle: true,
    },
  });

  if (!location) return apiError("Lagerort nicht gefunden", 404);

  return apiSuccess({
    id: location.id,
    name: location.name,
    locationType: location.locationType,
    description: location.description,
    vehicle: location.vehicle,
    stock: location.stockBalances.map((b) => ({
      balanceId: b.id,
      articleId: b.articleId,
      name: b.article.name,
      unit: b.article.unit,
      sku: b.article.sku,
      onHand: b.onHandQuantity,
      reserved: b.reservedQuantity,
      available: calcAvailableQuantity(b.onHandQuantity, b.reservedQuantity),
    })),
    totalOnHand: location.stockBalances.reduce((s, b) => s + b.onHandQuantity, 0),
    totalReserved: location.stockBalances.reduce((s, b) => s + b.reservedQuantity, 0),
  });
}
