import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { getProjectOrNull, mapProjectListItem } from "@/lib/projects/overview";

const linkSchema = z.object({
  orderId: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const { id: projectId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: auth.tenantId },
    select: { id: true, customerId: true },
  });
  if (!project) return apiError("Projekt nicht gefunden", 404);

  const body = await request.json().catch(() => null);
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) return apiError("orderId erforderlich");

  const order = await prisma.order.findFirst({
    where: { id: parsed.data.orderId, tenantId: auth.tenantId },
    select: { id: true, projectId: true, orderNumber: true },
  });
  if (!order) return apiError("Auftrag nicht gefunden", 404);

  await prisma.order.update({
    where: { id: order.id },
    data: { projectId },
  });

  const full = await getProjectOrNull(auth.tenantId, projectId);
  return apiSuccess(full ? mapProjectListItem(full) : { id: projectId });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const { id: projectId } = await params;
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");
  if (!orderId) return apiError("orderId erforderlich");

  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: auth.tenantId },
    select: { id: true },
  });
  if (!project) return apiError("Projekt nicht gefunden", 404);

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId: auth.tenantId, projectId },
    select: { id: true },
  });
  if (!order) return apiError("Auftrag nicht im Projekt gefunden", 404);

  await prisma.order.update({
    where: { id: order.id },
    data: { projectId: null },
  });

  const full = await getProjectOrNull(auth.tenantId, projectId);
  return apiSuccess(full ? mapProjectListItem(full) : { id: projectId });
}
