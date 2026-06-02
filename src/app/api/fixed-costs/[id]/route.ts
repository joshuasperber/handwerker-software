import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("calculations.settings");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.monthlyFixedCost.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!existing) return apiError("Fixkosten nicht gefunden", 404);

  const cost = await prisma.monthlyFixedCost.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      category: body.category ?? existing.category,
      amountNet: body.amountNet != null ? Number(body.amountNet) : existing.amountNet,
      isActive: body.isActive ?? existing.isActive,
      notes: body.notes ?? existing.notes,
    },
  });

  return apiSuccess(cost);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("calculations.settings");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  await prisma.monthlyFixedCost.deleteMany({ where: { id, tenantId: auth.tenantId } });
  return apiSuccess({ deleted: true });
}
