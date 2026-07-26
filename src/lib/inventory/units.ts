/** Vordefinierte Einheiten für Inventarartikel */
export const ARTICLE_UNITS = [
  "Stück",
  "Set",
  "100er-Set",
  "Schachtel",
  "Schatulle",
  "Karton",
  "Tube",
  "Dose",
  "Liter",
  "Milliliter",
  "Gramm",
  "Kilogramm",
  "Meter",
  "Quadratmeter",
] as const;

export type ArticleUnitPreset = (typeof ARTICLE_UNITS)[number];

export const CUSTOM_UNIT_VALUE = "__custom__";

/** Kurzformen → Anzeigename (für bestehende Daten) */
const UNIT_ALIASES: Record<string, string> = {
  Stk: "Stück",
  stk: "Stück",
  Stück: "Stück",
  Stueck: "Stück",
  pcs: "Stück",
  Set: "Set",
  "100er-Set": "100er-Set",
  Schachtel: "Schachtel",
  Schatulle: "Schatulle",
  Karton: "Karton",
  Tube: "Tube",
  Dose: "Dose",
  l: "Liter",
  L: "Liter",
  Liter: "Liter",
  ml: "Milliliter",
  Milliliter: "Milliliter",
  g: "Gramm",
  Gramm: "Gramm",
  kg: "Kilogramm",
  Kilogramm: "Kilogramm",
  m: "Meter",
  Meter: "Meter",
  m2: "Quadratmeter",
  "m²": "Quadratmeter",
  Quadratmeter: "Quadratmeter",
};

export function normalizeUnitLabel(unit: string | null | undefined): string {
  if (!unit?.trim()) return "Stück";
  const trimmed = unit.trim();
  return UNIT_ALIASES[trimmed] ?? trimmed;
}

export function isPresetUnit(unit: string): boolean {
  const normalized = normalizeUnitLabel(unit);
  return (ARTICLE_UNITS as readonly string[]).includes(normalized);
}

/**
 * Preis für die Kalkulation: bevorzugt Kalkulations-/Verkaufspreis,
 * sonst Einkaufspreis.
 */
export function articlePriceForCalculation(article: {
  salesPriceNet?: number | null;
  purchasePriceNet?: number | null;
}): number {
  if (article.salesPriceNet != null && Number.isFinite(article.salesPriceNet)) {
    return Number(article.salesPriceNet);
  }
  if (article.purchasePriceNet != null && Number.isFinite(article.purchasePriceNet)) {
    return Number(article.purchasePriceNet);
  }
  return 0;
}
