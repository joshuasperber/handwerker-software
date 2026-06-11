import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("customers.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const existing = await prisma.property.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!existing) return apiError("Adresse nicht gefunden", 404);

  const body = await request.json();

  const makePrimary = body.isPrimary === true;

  const property = await prisma.$transaction(async (tx) => {
    if (makePrimary) {
      await tx.property.updateMany({
        where: {
          tenantId: auth.tenantId,
          customerId: existing.customerId,
          id: { not: id },
        },
        data: { isPrimary: false },
      });
    }
    return tx.property.update({
      where: { id },
      data: {
        ...(body.label !== undefined ? { label: String(body.label) } : {}),
        ...(body.street !== undefined ? { street: String(body.street) } : {}),
        ...(body.zipCode !== undefined ? { zipCode: String(body.zipCode) } : {}),
        ...(body.city !== undefined ? { city: String(body.city) } : {}),
        ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
        ...(body.isPrimary !== undefined ? { isPrimary: body.isPrimary === true } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive === true } : {}),
        ...(body.travelZoneId !== undefined
          ? { travelZoneId: body.travelZoneId || null }
          : {}),
      },
      include: { travelZone: true },
    });
  });

  return apiSuccess(property);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("customers.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const existing = await prisma.property.findFirst({
    where: { id, tenantId: auth.tenantId },
    include: { _count: { select: { orders: true } } },
  });
  if (!existing) return apiError("Adresse nicht gefunden", 404);

  // Adressen mit Aufträgen werden deaktiviert statt gelöscht (Referenzschutz).
  if (existing._count.orders > 0) {
    const property = await prisma.property.update({
      where: { id },
      data: { isActive: false },
    });
    return apiSuccess({
      deleted: false,
      deactivated: true,
      property,
      message: `Adresse wird in ${existing._count.orders} Auftrag/Aufträgen verwendet und wurde deaktiviert.`,
    });
  }

  await prisma.property.delete({ where: { id } });
  return apiSuccess({ deleted: true, deactivated: false });
}
