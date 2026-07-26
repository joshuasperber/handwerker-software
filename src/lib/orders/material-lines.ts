import { articlePriceForCalculation } from "@/lib/inventory/units";

export type OrderMaterialLineInput = {
  articleId?: string | null;
  sourceServiceId?: string | null;
  name: string;
  quantityRequired: number;
  unit?: string;
  unitPriceNet?: number | null;
  notes?: string | null;
  isTool?: boolean;
};

export function normalizeOrderMaterialLineInput(
  raw: Record<string, unknown>
): OrderMaterialLineInput | null {
  const name = String(raw.name ?? "").trim();
  if (!name) return null;
  const quantityRequired = Number(raw.quantityRequired ?? raw.quantity ?? 1);
  if (!Number.isFinite(quantityRequired) || quantityRequired <= 0) return null;

  const unitPriceRaw = raw.unitPriceNet ?? raw.priceNet ?? raw.purchasePriceNet;
  const unitPriceNet =
    unitPriceRaw == null || unitPriceRaw === ""
      ? null
      : Number(unitPriceRaw);

  return {
    articleId: raw.articleId ? String(raw.articleId) : null,
    sourceServiceId: raw.sourceServiceId ? String(raw.sourceServiceId) : null,
    name,
    quantityRequired,
    unit: String(raw.unit ?? "Stück").trim() || "Stück",
    unitPriceNet:
      unitPriceNet != null && Number.isFinite(unitPriceNet) ? unitPriceNet : null,
    notes: raw.notes != null ? String(raw.notes).trim() || null : null,
    isTool: raw.isTool === true,
  };
}

/** Preis für Kalkulation: gespeicherter Override, sonst Artikelpreis. */
export function resolveMaterialLineUnitPrice(line: {
  unitPriceNet?: number | null;
  article?: {
    salesPriceNet?: number | null;
    purchasePriceNet?: number | null;
  } | null;
}): number {
  if (line.unitPriceNet != null && Number.isFinite(line.unitPriceNet)) {
    return Number(line.unitPriceNet);
  }
  if (line.article) return articlePriceForCalculation(line.article);
  return 0;
}
