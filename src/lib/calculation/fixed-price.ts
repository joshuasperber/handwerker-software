/** Vorschläge für die Kundenbezeichnung der Festpreis-Position. */
export const FIXED_PRICE_LABEL_PRESETS = [
  "Festpreis",
  "Pauschalpreis",
  "Pauschale für Montage und Material",
] as const;

export const DEFAULT_FIXED_PRICE_LABEL = "Festpreis";

export function resolveFixedPriceLabel(label?: string | null): string {
  const trimmed = label?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_FIXED_PRICE_LABEL;
}

export interface FixedPriceComparison {
  useFixedPrice: boolean;
  label: string;
  /** Intern kalkulierter Netto-Verkaufspreis (Engine). */
  calculatedNet: number;
  /** Nettobetrag für Angebot/Rechnung. */
  customerNet: number;
  /** Festpreis − kalkulierter Netto. */
  difference: number;
  /** Geschätzter Gewinn: Engine-Gewinn + Differenz zum Festpreis. */
  estimatedProfit: number;
  /** Marge auf Basis Festpreis vs. direkte Kosten (falls Festpreis > 0). */
  marginPercent: number | null;
}

/**
 * Interne Vergleichswerte: Kalkulation bleibt unverändert,
 * Festpreis steuert nur Kundenpreis und Darstellung.
 */
export function compareFixedPrice(input: {
  useFixedPrice?: boolean | null;
  fixedPriceNet?: number | null;
  fixedPriceLabel?: string | null;
  calculatedNet: number;
  profitAmount?: number | null;
  directCosts?: number | null;
}): FixedPriceComparison {
  const useFixedPrice = Boolean(input.useFixedPrice);
  const label = resolveFixedPriceLabel(input.fixedPriceLabel);
  const calculatedNet = Number(input.calculatedNet) || 0;
  const customerNet =
    useFixedPrice && input.fixedPriceNet != null && Number.isFinite(Number(input.fixedPriceNet))
      ? Number(input.fixedPriceNet)
      : calculatedNet;
  const difference = customerNet - calculatedNet;
  const estimatedProfit = (Number(input.profitAmount) || 0) + difference;
  const directCosts = Number(input.directCosts) || 0;
  const marginPercent =
    customerNet > 0.0001 ? ((customerNet - directCosts) / customerNet) * 100 : null;

  return {
    useFixedPrice,
    label,
    calculatedNet,
    customerNet,
    difference,
    estimatedProfit,
    marginPercent,
  };
}
