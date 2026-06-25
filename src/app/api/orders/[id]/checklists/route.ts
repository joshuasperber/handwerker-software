import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { parseBody } from "@/lib/api-body";
import {
  toggleChecklistSchema,
  applyChecklistTemplateSchema,
} from "@/lib/schemas/orders";
import { toggleOrderChecklistItem } from "@/lib/orders/checklist";

export async function GET(
  _request: NextRequest,
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
  const body = await parseBody(request, toggleChecklistSchema);
  if (body instanceof Response) return body;

  const updated = await toggleOrderChecklistItem({
    tenantId: auth.tenantId,
    orderId,
    checklistId: body.checklistId,
    isChecked: body.isChecked,
    userId: auth.id,
  });

  if (updated instanceof Response) return updated;
  return apiSuccess(updated);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("checklists.write");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;
  const body = await parseBody(request, applyChecklistTemplateSchema);
  if (body instanceof Response) return body;

  const template = await prisma.checklistTemplate.findFirst({
    where: { id: body.templateId, tenantId: auth.tenantId },
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
