import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";

const createSchema = z.object({
  description: z.string().min(1).max(1000),
  occurredOn: z.string().optional().nullable(),
  materialNote: z.string().max(1000).optional().nullable(),
  extraHours: z.coerce.number().min(0).optional().nullable(),
  extraPriceNet: z.coerce.number().min(0).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
  employeeName: z.string().max(200).optional().nullable(),
  applyToFixedPrice: z.boolean().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, tenantId: auth.tenantId },
    select: { id: true },
  });
  if (!order) return apiError("Auftrag nicht gefunden", 404);
  const items = await prisma.orderAddendum.findMany({
    where: { orderId: id, tenantId: auth.tenantId },
    orderBy: { occurredOn: "desc" },
  });
  return apiSuccess(items);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!order) return apiError("Auftrag nicht gefunden", 404);

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  const data = parsed.data;

  const item = await prisma.orderAddendum.create({
    data: {
      tenantId: auth.tenantId,
      orderId: id,
      description: data.description.trim(),
      occurredOn: data.occurredOn ? new Date(data.occurredOn) : new Date(),
      materialNote: data.materialNote?.trim() || null,
      extraHours: data.extraHours ?? null,
      extraPriceNet: data.extraPriceNet ?? null,
      note: data.note?.trim() || null,
      employeeName: data.employeeName?.trim() || null,
      createdById: auth.id,
    },
  });

  let fixedPriceNet = order.fixedPriceNet;
  if (data.applyToFixedPrice && order.useFixedPrice && data.extraPriceNet && data.extraPriceNet > 0) {
    fixedPriceNet = Math.round(((order.fixedPriceNet ?? 0) + data.extraPriceNet) * 100) / 100;
    await prisma.order.update({
      where: { id },
      data: { fixedPriceNet },
    });
    await prisma.calculation.updateMany({
      where: { tenantId: auth.tenantId, orderId: id, useFixedPrice: true },
      data: { fixedPriceNet },
    });
  }

  await createAuditLog({
    tenantId: auth.tenantId,
    userId: auth.id,
    entityType: "Order",
    entityId: id,
    action: "ORDER_ADDENDUM",
    newValues: {
      addendumId: item.id,
      description: item.description,
      extraHours: item.extraHours,
      extraPriceNet: item.extraPriceNet,
      fixedPriceNet,
    },
  });

  return apiSuccess({ addendum: item, fixedPriceNet }, 201);
}
