import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("services.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.service.findFirst({ where: { id, tenantId: auth.tenantId } });
  if (!existing) return apiError("Leistung nicht gefunden", 404);

  const service = await prisma.service.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.durationMinutes !== undefined ? { durationMinutes: Number(body.durationMinutes) } : {}),
      ...(body.bufferMinutes !== undefined ? { bufferMinutes: Number(body.bufferMinutes) } : {}),
      ...(body.priceCents !== undefined ? { priceCents: body.priceCents ? Number(body.priceCents) : null } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: Number(body.sortOrder) } : {}),
    },
  });

  return apiSuccess(service);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("services.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const existing = await prisma.service.findFirst({ where: { id, tenantId: auth.tenantId } });
  if (!existing) return apiError("Leistung nicht gefunden", 404);

  await prisma.service.update({ where: { id }, data: { isActive: false } });
  return apiSuccess({ deactivated: true });
}
