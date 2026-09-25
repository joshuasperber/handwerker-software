import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { receivePurchaseOrder } from "@/lib/inventory/consumption";
import { addOrderedQuantities } from "@/lib/inventory/purchase-order-stock";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("inventory.read");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const po = await prisma.purchaseOrder.findFirst({
    where: { id, tenantId: auth.tenantId },
    include: {
      lines: { include: { article: true } },
      deliveries: { orderBy: { createdAt: "desc" } },
      order: true,
    },
  });
  if (!po) return apiError("Bestellung nicht gefunden", 404);
  return apiSuccess(po);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("inventory.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.purchaseOrder.findFirst({
    where: { id, tenantId: auth.tenantId },
    include: { lines: true },
  });
  if (!existing) return apiError("Bestellung nicht gefunden", 404);

  if (body.action === "receive" && body.lines) {
    const result = await receivePurchaseOrder(
      auth.tenantId,
      id,
      body.lines,
      body.storageLocationId
    );
    return apiSuccess(result);
  }

  const po = await prisma.$transaction(async (transaction) => {
    if (body.status === "ORDERED" && !existing.orderedAt) {
      await addOrderedQuantities(
        transaction,
        auth.tenantId,
        existing.lines.map((line) => ({
          articleId: line.articleId,
          quantity: line.quantityOrdered - line.quantityReceived,
        })).filter((line) => line.quantity > 0)
      );
    }
    return transaction.purchaseOrder.update({
      where: { id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.supplierName ? { supplierName: body.supplierName } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.expectedAt ? { expectedAt: new Date(body.expectedAt) } : {}),
        ...(body.status === "ORDERED" && !existing.orderedAt ? { orderedAt: new Date() } : {}),
      },
      include: { lines: { include: { article: true } } },
    });
  }, { isolationLevel: "Serializable" });

  return apiSuccess(po);
}
