import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { generatePoNumber } from "@/lib/inventory/reorder";
import { requireTenantOrder } from "@/lib/tenant-scope";

export async function GET() {
  const auth = await requireAuth("inventory.read");
  if (auth instanceof Response) return auth;

  const orders = await prisma.purchaseOrder.findMany({
    where: { tenantId: auth.tenantId },
    include: {
      lines: { include: { article: true } },
      order: { select: { id: true, orderNumber: true } },
      deliveries: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return apiSuccess(orders);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("inventory.write");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const lines: { articleId: string; quantityOrdered: number; unitPriceNet?: number }[] = body.lines ?? [];
  if (!lines.length) return apiError("Mindestens eine Position erforderlich", 400);

  if (body.orderId) {
    const order = await requireTenantOrder(auth.tenantId, body.orderId);
    if (!order) return apiError("Auftrag nicht gefunden", 404);
  }

  const articleIds = lines.map((l) => l.articleId);
  const articleCount = await prisma.article.count({
    where: { id: { in: articleIds }, tenantId: auth.tenantId },
  });
  if (articleCount !== articleIds.length) return apiError("Artikel nicht gefunden", 404);

  const po = await prisma.purchaseOrder.create({
    data: {
      tenantId: auth.tenantId,
      poNumber: body.poNumber ?? generatePoNumber(),
      supplierName: body.supplierName ?? "Unbekannt",
      status: body.status ?? "DRAFT",
      orderId: body.orderId,
      notes: body.notes,
      orderedAt: body.status === "ORDERED" ? new Date() : undefined,
      expectedAt: body.expectedAt ? new Date(body.expectedAt) : undefined,
      lines: {
        create: lines.map((l) => ({
          articleId: l.articleId,
          quantityOrdered: l.quantityOrdered,
          unitPriceNet: l.unitPriceNet,
        })),
      },
    },
    include: { lines: { include: { article: true } } },
  });

  if (body.status === "ORDERED") {
    for (const line of po.lines) {
      await prisma.stockBalance.updateMany({
        where: { articleId: line.articleId, article: { tenantId: auth.tenantId } },
        data: { orderedQuantity: { increment: line.quantityOrdered } },
      });
    }
  }

  return apiSuccess(po, 201);
}
