import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const item = await prisma.orderTypeDefinition.findFirst({
    where: { id, tenantId: auth.tenantId },
    include: { _count: { select: { orders: true } } },
  });
  if (!item) return apiError("Auftragstyp nicht gefunden", 404);
  return apiSuccess(item);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const existing = await prisma.orderTypeDefinition.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!existing) return apiError("Auftragstyp nicht gefunden", 404);

  const body = await request.json();
  const data: {
    name?: string;
    isActive?: boolean;
    isOther?: boolean;
    sortOrder?: number;
  } = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return apiError("Bezeichnung ist Pflicht", 400);
    data.name = name;
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder);
  if (body.isOther !== undefined) {
    data.isOther = Boolean(body.isOther);
    if (data.isOther) {
      const other = await prisma.orderTypeDefinition.findFirst({
        where: { tenantId: auth.tenantId, isOther: true, NOT: { id } },
      });
      if (other) {
        return apiError("Es gibt bereits einen Auftragstyp „Sonstiges“", 409);
      }
    }
  }

  try {
    const item = await prisma.orderTypeDefinition.update({
      where: { id },
      data,
      include: { _count: { select: { orders: true } } },
    });
    return apiSuccess(item);
  } catch {
    return apiError("Ein Auftragstyp mit diesem Namen existiert bereits", 409);
  }
}

/**
 * Ungenutzte Typen werden gelöscht.
 * Genutzte Typen werden deaktiviert (Historie bleibt).
 * Optional: `?mode=deactivate` erzwingt Deaktivieren.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const mode = new URL(request.url).searchParams.get("mode");

  const existing = await prisma.orderTypeDefinition.findFirst({
    where: { id, tenantId: auth.tenantId },
    include: { _count: { select: { orders: true } } },
  });
  if (!existing) return apiError("Auftragstyp nicht gefunden", 404);

  const inUse = existing._count.orders > 0;
  const forceDeactivate = mode === "deactivate";

  if (forceDeactivate || inUse) {
    if (!existing.isActive && inUse) {
      return apiSuccess({
        action: "already_inactive" as const,
        message:
          "Der Auftragstyp ist bereits deaktiviert und bleibt wegen bestehender Aufträge erhalten.",
        usageCount: existing._count.orders,
      });
    }

    const item = await prisma.orderTypeDefinition.update({
      where: { id },
      data: { isActive: false },
      include: { _count: { select: { orders: true } } },
    });

    return apiSuccess({
      action: "deactivated" as const,
      message: inUse
        ? `Auftragstyp wurde deaktiviert (in ${existing._count.orders} Auftrag/Aufträgen verwendet). Bestehende Aufträge bleiben unverändert.`
        : "Auftragstyp wurde deaktiviert und erscheint nicht mehr bei neuen Aufträgen.",
      usageCount: existing._count.orders,
      item,
    });
  }

  await prisma.orderTypeDefinition.delete({ where: { id } });

  return apiSuccess({
    action: "deleted" as const,
    message: "Auftragstyp wurde endgültig gelöscht.",
    usageCount: 0,
  });
}
