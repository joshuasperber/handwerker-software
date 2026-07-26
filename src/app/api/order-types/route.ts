import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { ensureOrderTypeDefinitions } from "@/lib/orders/order-types";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  await ensureOrderTypeDefinitions(auth.tenantId);

  const includeInactive =
    new URL(request.url).searchParams.get("includeInactive") === "1";

  const items = await prisma.orderTypeDefinition.findMany({
    where: {
      tenantId: auth.tenantId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    include: {
      _count: { select: { orders: true } },
    },
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return apiSuccess(items);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  await ensureOrderTypeDefinitions(auth.tenantId);

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return apiError("Bezeichnung ist Pflicht", 400);

  const isOther = body.isOther === true;
  if (isOther) {
    const existingOther = await prisma.orderTypeDefinition.findFirst({
      where: { tenantId: auth.tenantId, isOther: true },
    });
    if (existingOther) {
      return apiError("Es gibt bereits einen Auftragstyp „Sonstiges“", 409);
    }
  }

  const maxSort = await prisma.orderTypeDefinition.aggregate({
    where: { tenantId: auth.tenantId },
    _max: { sortOrder: true },
  });

  try {
    const item = await prisma.orderTypeDefinition.create({
      data: {
        tenantId: auth.tenantId,
        name,
        isOther,
        isActive: body.isActive !== false,
        sortOrder:
          body.sortOrder != null
            ? Number(body.sortOrder)
            : (maxSort._max.sortOrder ?? 0) + 10,
      },
      include: { _count: { select: { orders: true } } },
    });
    return apiSuccess(item, 201);
  } catch {
    return apiError("Ein Auftragstyp mit diesem Namen existiert bereits", 409);
  }
}
