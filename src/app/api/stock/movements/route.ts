import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";
import { calcDocumentedUnitMargin } from "@/lib/inventory/reasons";

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
      order: { select: { id: true, orderNumber: true } },
      customer: { select: { id: true, firstName: true, lastName: true } },
      employee: {
        select: {
          id: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  const data = movements.map((m) => {
    const unitMargin = calcDocumentedUnitMargin(m.purchasePriceNet, m.salePriceNet);
    return {
      ...m,
      documentedUnitMargin: unitMargin,
      documentedTotalMargin:
        unitMargin != null ? Math.round(unitMargin * m.quantity * 100) / 100 : null,
      hasReceipt: Boolean(m.receiptStorageKey),
    };
  });

  return apiSuccess(data);
}
