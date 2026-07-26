import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

/** Reihenfolge der Auftragstypen aktualisieren. Body: { orderedIds: string[] } */
export async function PUT(request: NextRequest) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const orderedIds: unknown = body.orderedIds;
  if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== "string")) {
    return apiError("orderedIds (string[]) erforderlich", 400);
  }

  const existing = await prisma.orderTypeDefinition.findMany({
    where: { tenantId: auth.tenantId, id: { in: orderedIds as string[] } },
    select: { id: true },
  });
  if (existing.length !== orderedIds.length) {
    return apiError("Ungültige Auftragstyp-IDs", 400);
  }

  await prisma.$transaction(
    (orderedIds as string[]).map((id, index) =>
      prisma.orderTypeDefinition.update({
        where: { id },
        data: { sortOrder: (index + 1) * 10 },
      })
    )
  );

  const items = await prisma.orderTypeDefinition.findMany({
    where: { tenantId: auth.tenantId },
    include: { _count: { select: { orders: true } } },
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return apiSuccess(items);
}
