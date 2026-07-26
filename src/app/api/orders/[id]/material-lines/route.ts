import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { requireTenantOrder } from "@/lib/tenant-scope";
import { checkOrderMaterialStatus } from "@/lib/inventory/orders";
import {
  normalizeOrderMaterialLineInput,
  resolveMaterialLineUnitPrice,
  type OrderMaterialLineInput,
} from "@/lib/orders/material-lines";
import { articlePriceForCalculation } from "@/lib/inventory/units";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;
  const order = await requireTenantOrder(auth.tenantId, orderId);
  if (!order) return apiError("Auftrag nicht gefunden", 404);

  const lines = await prisma.orderMaterialLine.findMany({
    where: { orderId },
    include: { article: true },
    orderBy: { createdAt: "asc" },
  });

  return apiSuccess(
    lines.map((l) => ({
      ...l,
      resolvedUnitPriceNet: resolveMaterialLineUnitPrice(l),
    }))
  );
}

/** Ersetzt alle Materialpositionen des Auftrags (ohne Werkzeuge optional beibehalten). */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;
  const order = await requireTenantOrder(auth.tenantId, orderId);
  if (!order) return apiError("Auftrag nicht gefunden", 404);

  const body = await request.json();
  const rawLines: unknown[] = Array.isArray(body.lines) ? body.lines : [];
  const keepTools = body.keepTools !== false;

  const normalized: OrderMaterialLineInput[] = rawLines
    .map((l) => normalizeOrderMaterialLineInput((l ?? {}) as Record<string, unknown>))
    .filter((l): l is OrderMaterialLineInput => l != null);

  // Artikel-Preise nachziehen, wenn Override fehlt
  const articleIds = normalized
    .map((l) => l.articleId)
    .filter((id): id is string => Boolean(id));
  const articles = articleIds.length
    ? await prisma.article.findMany({
        where: { tenantId: auth.tenantId, id: { in: articleIds } },
      })
    : [];
  const articleMap = new Map(articles.map((a) => [a.id, a]));

  await prisma.$transaction(async (tx) => {
    if (keepTools) {
      await tx.orderMaterialLine.deleteMany({ where: { orderId, isTool: false } });
    } else {
      await tx.orderMaterialLine.deleteMany({ where: { orderId } });
    }

    if (normalized.length) {
      await tx.orderMaterialLine.createMany({
        data: normalized.map((l) => {
          const article = l.articleId ? articleMap.get(l.articleId) : null;
          return {
            orderId,
            articleId: l.articleId,
            sourceServiceId: l.sourceServiceId,
            name: l.name,
            quantityRequired: l.quantityRequired,
            unit: l.unit ?? "Stück",
            unitPriceNet:
              l.unitPriceNet ??
              (article ? articlePriceForCalculation(article) : null),
            notes: l.notes,
            isTool: l.isTool === true,
            lineStatus: "NOT_CHECKED" as const,
          };
        }),
      });
    }
  });

  await checkOrderMaterialStatus(orderId, auth.tenantId);

  const lines = await prisma.orderMaterialLine.findMany({
    where: { orderId },
    include: { article: true },
    orderBy: { createdAt: "asc" },
  });

  return apiSuccess(lines);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;
  const order = await requireTenantOrder(auth.tenantId, orderId);
  if (!order) return apiError("Auftrag nicht gefunden", 404);

  const body = await request.json();
  const normalized = normalizeOrderMaterialLineInput(body);
  if (!normalized) return apiError("Name und Menge sind Pflicht", 400);

  let unitPriceNet = normalized.unitPriceNet;
  if (normalized.articleId && unitPriceNet == null) {
    const article = await prisma.article.findFirst({
      where: { id: normalized.articleId, tenantId: auth.tenantId },
    });
    if (!article) return apiError("Artikel nicht gefunden", 404);
    unitPriceNet = articlePriceForCalculation(article);
  }

  const line = await prisma.orderMaterialLine.create({
    data: {
      orderId,
      articleId: normalized.articleId,
      sourceServiceId: normalized.sourceServiceId,
      name: normalized.name,
      quantityRequired: normalized.quantityRequired,
      unit: normalized.unit ?? "Stück",
      unitPriceNet,
      notes: normalized.notes,
      isTool: normalized.isTool === true,
    },
    include: { article: true },
  });

  await checkOrderMaterialStatus(orderId, auth.tenantId);
  return apiSuccess(line, 201);
}
