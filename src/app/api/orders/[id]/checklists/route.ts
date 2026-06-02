import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;

  const checklists = await prisma.orderChecklist.findMany({
    where: { orderId, order: { tenantId: auth.tenantId } },
    orderBy: { sortOrder: "asc" },
  });

  return apiSuccess(checklists);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;
  const body = await request.json();
  const { checklistId, isChecked } = body;

  const item = await prisma.orderChecklist.findFirst({
    where: { id: checklistId, orderId, order: { tenantId: auth.tenantId } },
  });

  if (!item) return apiError("Checklistenpunkt nicht gefunden", 404);

  const updated = await prisma.orderChecklist.update({
    where: { id: checklistId },
    data: {
      isChecked,
      checkedAt: isChecked ? new Date() : null,
      checkedBy: isChecked ? auth.id : null,
    },
  });

  return apiSuccess(updated);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("checklists.write");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;
  const { templateId } = await request.json();

  const template = await prisma.checklistTemplate.findFirst({
    where: { id: templateId, tenantId: auth.tenantId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  if (!template) return apiError("Vorlage nicht gefunden", 404);

  const items = await prisma.orderChecklist.createMany({
    data: template.items.map((item) => ({
      orderId,
      templateId: template.id,
      label: item.label,
      sortOrder: item.sortOrder,
    })),
  });

  return apiSuccess(items, 201);
}
