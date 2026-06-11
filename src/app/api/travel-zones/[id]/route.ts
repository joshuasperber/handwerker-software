import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { validateZonePayload } from "../route";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("calculations.settings");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const existing = await prisma.travelZone.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!existing) return apiError("Zone nicht gefunden", 404);

  const body = await request.json();

  // Bei reiner (De-)Aktivierung keine vollständige Preisvalidierung erzwingen.
  const isOnlyToggle =
    Object.keys(body).length === 1 && body.isActive !== undefined;

  if (!isOnlyToggle) {
    const merged = {
      name: body.name ?? existing.name,
      flatFeeNet: body.flatFeeNet ?? existing.flatFeeNet,
      useFormula: body.useFormula ?? existing.useFormula,
      minKm: body.minKm ?? existing.minKm,
      maxKm: body.maxKm ?? existing.maxKm,
    };
    const validationError = validateZonePayload(merged);
    if (validationError) return apiError(validationError, 400);
  }

  const useFormula =
    body.useFormula !== undefined ? body.useFormula === true : existing.useFormula;

  const zone = await prisma.travelZone.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
      ...(body.description !== undefined
        ? { description: body.description ? String(body.description) : null }
        : {}),
      ...(body.minKm !== undefined
        ? { minKm: body.minKm === "" || body.minKm == null ? 0 : Number(body.minKm) }
        : {}),
      ...(body.maxKm !== undefined
        ? { maxKm: body.maxKm === "" || body.maxKm == null ? null : Number(body.maxKm) }
        : {}),
      ...(body.flatFeeNet !== undefined || body.useFormula !== undefined
        ? { flatFeeNet: useFormula ? 0 : Number(body.flatFeeNet ?? existing.flatFeeNet) }
        : {}),
      ...(body.useFormula !== undefined ? { useFormula } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive === true } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: Number(body.sortOrder) } : {}),
    },
  });

  return apiSuccess(zone);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("calculations.settings");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const existing = await prisma.travelZone.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!existing) return apiError("Zone nicht gefunden", 404);

  // Wird die Zone noch von Standorten verwendet, deaktivieren statt löschen.
  const inUse = await prisma.property.count({
    where: { tenantId: auth.tenantId, travelZoneId: id },
  });

  if (inUse > 0) {
    const zone = await prisma.travelZone.update({
      where: { id },
      data: { isActive: false },
    });
    return apiSuccess({
      deleted: false,
      deactivated: true,
      zone,
      message: `Zone wird noch von ${inUse} Standort(en) verwendet und wurde deaktiviert.`,
    });
  }

  await prisma.travelZone.delete({ where: { id } });
  return apiSuccess({ deleted: true, deactivated: false });
}
