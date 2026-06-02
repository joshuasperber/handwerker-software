import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";
import { calcAvailableQuantity, calcReorderSuggestion } from "@/lib/inventory/formulas";

export async function GET() {
  const auth = await requireAuth("inventory.read");
  if (auth instanceof Response) return auth;

  const balances = await prisma.stockBalance.findMany({
    where: { article: { tenantId: auth.tenantId } },
    include: {
      article: true,
      storageLocation: true,
    },
  });

  const byArticle = new Map<
    string,
    {
      article: (typeof balances)[0]["article"];
      onHand: number;
      reserved: number;
      ordered: number;
      available: number;
      locations: { name: string; onHand: number; reserved: number; available: number }[];
      reorderSuggestion: number;
      lowStock: boolean;
    }
  >();

  for (const b of balances) {
    const entry = byArticle.get(b.articleId) ?? {
      article: b.article,
      onHand: 0,
      reserved: 0,
      ordered: 0,
      available: 0,
      locations: [],
      reorderSuggestion: 0,
      lowStock: false,
    };
    entry.onHand += b.onHandQuantity;
    entry.reserved += b.reservedQuantity;
    entry.ordered += b.orderedQuantity;
    entry.locations.push({
      name: b.storageLocation.name,
      onHand: b.onHandQuantity,
      reserved: b.reservedQuantity,
      available: calcAvailableQuantity(b.onHandQuantity, b.reservedQuantity),
    });
    byArticle.set(b.articleId, entry);
  }

  const summary = [...byArticle.values()].map((e) => {
    const available = calcAvailableQuantity(e.onHand, e.reserved);
    const reorderSuggestion = calcReorderSuggestion({
      targetStock: e.article.targetStock,
      availableTotal: available,
      openOrderDemand: 0,
      packageSize: e.article.packageSize,
    });
    return {
      articleId: e.article.id,
      name: e.article.name,
      unit: e.article.unit,
      category: e.article.category,
      minimumStock: e.article.minimumStock,
      targetStock: e.article.targetStock,
      onHand: e.onHand,
      reserved: e.reserved,
      ordered: e.ordered,
      available,
      lowStock: available < e.article.minimumStock,
      reorderSuggestion,
      locations: e.locations,
    };
  });

  const warnings = summary.filter((s) => s.lowStock);

  return apiSuccess({ items: summary, warnings, warningCount: warnings.length });
}
