import { prisma } from "@/lib/prisma";
import { calcAvailableQuantity, calcReorderSuggestion } from "./formulas";

async function loadManualSuggestions(tenantId: string) {
  try {
    return await prisma.manualReorderSuggestion.findMany({
      where: { tenantId },
      include: { article: { include: { stockBalances: true } } },
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    console.warn("[reorder] ManualReorderSuggestion nicht verfügbar – DB-Migration ausführen?", err);
    return [];
  }
}

export async function getOpenOrderDemand(tenantId: string, articleId: string): Promise<number> {
  const lines = await prisma.orderMaterialLine.findMany({
    where: {
      articleId,
      isTool: false,
      order: { tenantId, materialStatus: { in: ["MISSING", "PARTLY_AVAILABLE", "ORDERED"] } },
    },
  });

  return lines.reduce((s, l) => {
    const open = Math.max(0, l.quantityRequired - l.quantityConsumed);
    return s + open;
  }, 0);
}

export async function getReorderSuggestions(tenantId: string) {
  const articles = await prisma.article.findMany({
    where: { tenantId, isActive: true },
    include: { stockBalances: true },
  });

  const manual = await loadManualSuggestions(tenantId);

  const suggestions: {
    articleId: string;
    name: string;
    unit: string;
    available: number;
    minimumStock: number;
    targetStock: number;
    openOrderDemand: number;
    suggestedQuantity: number;
    supplierName: string | null;
    strategy: string;
    source: "auto" | "manual";
    manualId?: string;
    note?: string | null;
  }[] = [];

  const manualArticleIds = new Set<string>();

  for (const m of manual) {
    manualArticleIds.add(m.articleId);
    const onHand = m.article.stockBalances?.reduce((s, b) => s + b.onHandQuantity, 0) ?? 0;
    const reserved = m.article.stockBalances?.reduce((s, b) => s + b.reservedQuantity, 0) ?? 0;
    suggestions.push({
      articleId: m.articleId,
      name: m.article.name,
      unit: m.article.unit,
      available: calcAvailableQuantity(onHand, reserved),
      minimumStock: m.article.minimumStock,
      targetStock: m.article.targetStock,
      openOrderDemand: 0,
      suggestedQuantity: m.quantity,
      supplierName: m.supplierName ?? m.article.supplierName,
      strategy: "MANUELL",
      source: "manual",
      manualId: m.id,
      note: m.note,
    });
  }

  for (const article of articles) {
    if (manualArticleIds.has(article.id)) continue;

    const onHand = article.stockBalances.reduce((s, b) => s + b.onHandQuantity, 0);
    const reserved = article.stockBalances.reduce((s, b) => s + b.reservedQuantity, 0);
    const available = calcAvailableQuantity(onHand, reserved);
    const openDemand = await getOpenOrderDemand(tenantId, article.id);

    const needReorder =
      available < article.minimumStock ||
      openDemand > available ||
      (article.reorderStrategy !== "MANUELL" && available < article.targetStock);

    if (!needReorder) continue;

    const quantity = calcReorderSuggestion({
      targetStock: article.targetStock,
      availableTotal: available,
      openOrderDemand: Math.max(0, openDemand - available),
      packageSize: article.packageSize,
      minimumOrderQty: article.reorderQuantity > 0 ? article.reorderQuantity : undefined,
    });

    if (quantity <= 0 && article.reorderStrategy === "MANUELL" && available < article.minimumStock) {
      suggestions.push({
        articleId: article.id,
        name: article.name,
        unit: article.unit,
        available,
        minimumStock: article.minimumStock,
        targetStock: article.targetStock,
        openOrderDemand: openDemand,
        suggestedQuantity: article.reorderQuantity || article.targetStock - available,
        supplierName: article.supplierName,
        strategy: article.reorderStrategy,
        source: "auto",
      });
    } else if (quantity > 0) {
      suggestions.push({
        articleId: article.id,
        name: article.name,
        unit: article.unit,
        available,
        minimumStock: article.minimumStock,
        targetStock: article.targetStock,
        openOrderDemand: openDemand,
        suggestedQuantity: quantity,
        supplierName: article.supplierName,
        strategy: article.reorderStrategy,
        source: "auto",
      });
    }
  }

  return suggestions;
}

export function generatePoNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `PO-${year}-${random}`;
}
