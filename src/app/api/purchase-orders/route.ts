import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { generatePoNumber } from "@/lib/inventory/reorder";
import { requireTenantOrder } from "@/lib/tenant-scope";
import { addOrderedQuantities } from "@/lib/inventory/purchase-order-stock";

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
  if (
    lines.some(
      (line) =>
        !line.articleId ||
        !Number.isFinite(line.quantityOrdered) ||
        line.quantityOrdered <= 0 ||
        (line.unitPriceNet !== undefined && !Number.isFinite(line.unitPriceNet))
    )
  ) {
    return apiError("Bestellmengen müssen größer als 0 sein", 400);
  }

  if (body.orderId) {
    const order = await requireTenantOrder(auth.tenantId, body.orderId);
    if (!order) return apiError("Auftrag nicht gefunden", 404);
  }

  const articleIds = [...new Set(lines.map((line) => line.articleId))];
  const articleCount = await prisma.article.count({
    where: { id: { in: articleIds }, tenantId: auth.tenantId },
  });
  if (articleCount !== articleIds.length) return apiError("Artikel nicht gefunden", 404);

  const po = await prisma.$transaction(async (transaction) => {
    const created = await transaction.purchaseOrder.create({
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
          create: lines.map((line) => ({
            articleId: line.articleId,
            quantityOrdered: line.quantityOrdered,
            unitPriceNet: line.unitPriceNet,
          })),
        },
      },
      include: { lines: { include: { article: true } } },
    });
    if (body.status === "ORDERED") {
      await addOrderedQuantities(
        transaction,
        auth.tenantId,
        created.lines.map((line) => ({
          articleId: line.articleId,
          quantity: line.quantityOrdered,
        }))
      );
    }
    return created;
  }, { isolationLevel: "Serializable" });

  return apiSuccess(po, 201);
}
