import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("inventory.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.article.findFirst({ where: { id, tenantId: auth.tenantId } });
  if (!existing) return apiError("Artikel nicht gefunden", 404);

  const article = await prisma.article.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      sku: body.sku ?? existing.sku,
      unit: body.unit ?? existing.unit,
      category: body.category ?? existing.category,
      minimumStock: body.minimumStock != null ? Number(body.minimumStock) : undefined,
      targetStock: body.targetStock != null ? Number(body.targetStock) : undefined,
      isActive: body.isActive ?? existing.isActive,
    },
  });

  return apiSuccess(article);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("inventory.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  await prisma.article.updateMany({
    where: { id, tenantId: auth.tenantId },
    data: { isActive: false },
  });
  return apiSuccess({ deleted: true });
}
