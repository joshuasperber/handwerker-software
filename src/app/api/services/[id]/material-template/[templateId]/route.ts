import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  const auth = await requireAuth("services.write");
  if (auth instanceof Response) return auth;

  const { id: serviceId, templateId } = await params;
  const body = await request.json();

  const template = await prisma.serviceMaterialTemplate.findFirst({
    where: { id: templateId, serviceId, service: { tenantId: auth.tenantId } },
  });
  if (!template) return apiError("Stücklistenposition nicht gefunden", 404);

  const updated = await prisma.serviceMaterialTemplate.update({
    where: { id: templateId },
    data: {
      ...(body.articleId !== undefined ? { articleId: body.articleId } : {}),
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.defaultQuantity !== undefined ? { defaultQuantity: Number(body.defaultQuantity) } : {}),
      ...(body.unit !== undefined ? { unit: body.unit } : {}),
      ...(body.isReservable !== undefined ? { isReservable: body.isReservable } : {}),
      ...(body.isTool !== undefined ? { isTool: body.isTool } : {}),
    },
    include: { article: true },
  });

  return apiSuccess(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  const auth = await requireAuth("services.write");
  if (auth instanceof Response) return auth;

  const { id: serviceId, templateId } = await params;

  const template = await prisma.serviceMaterialTemplate.findFirst({
    where: { id: templateId, serviceId, service: { tenantId: auth.tenantId } },
  });
  if (!template) return apiError("Stücklistenposition nicht gefunden", 404);

  await prisma.serviceMaterialTemplate.delete({ where: { id: templateId } });
  return apiSuccess({ deleted: true });
}
