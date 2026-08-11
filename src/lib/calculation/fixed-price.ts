/** Vorschläge für die Kundenbezeichnung der Festpreis-Position. */
export const FIXED_PRICE_LABEL_PRESETS = [
  "Pauschalpreis für Montage und Material",
  "Pauschale für Lieferung und Montage",
  "Festpreis inkl. Material und Anfahrt",
  "Pauschalpreis",
] as const;

export const DEFAULT_FIXED_PRICE_LABEL = "Pauschalpreis";

/** Kundendarstellung bei aktivem Festpreis. */
export type FixedPriceDisplayMode =
  | "SINGLE_LINE"
  | "POSITIONS_WITH_PRICES"
  | "DESCRIPTION_ONLY";

export const FIXED_PRICE_DISPLAY_MODES: {
  value: FixedPriceDisplayMode;
  label: string;
  description: string;
}[] = [
  {
    value: "SINGLE_LINE",
    label: "Nur eine Festpreisposition",
    description: "Eine professionelle Pauschalposition mit Betrag",
  },
  {
    value: "POSITIONS_WITH_PRICES",
    label: "Positionen mit Preisen",
    description: "Leistungspositionen sichtbar; verbindlich ist der Festpreis",
  },
  {
    value: "DESCRIPTION_ONLY",
    label: "Positionen ohne Einzelpreise",
    description: "Leistungsbeschreibung ohne Beträge; Festpreis als Gesamtbetrag",
  },
];

export function resolveFixedPriceLabel(label?: string | null): string {
  const trimmed = label?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_FIXED_PRICE_LABEL;
}

export function resolveFixedPriceDisplayMode(
  mode?: string | null
): FixedPriceDisplayMode {
  if (
    mode === "SINGLE_LINE" ||
    mode === "POSITIONS_WITH_PRICES" ||
    mode === "DESCRIPTION_ONLY"
  ) {
    return mode;
  }
  return "SINGLE_LINE";
}

export function suggestFixedPriceLabel(title?: string | null): string {
  const t = title?.trim();
  if (!t) return DEFAULT_FIXED_PRICE_LABEL;
  return `Pauschalpreis für ${t}`;
}

export interface FixedPriceComparison {
  useFixedPrice: boolean;
  label: string;
  displayMode: FixedPriceDisplayMode;
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
  fixedPriceDisplayMode?: string | null;
  calculatedNet: number;
  profitAmount?: number | null;
  directCosts?: number | null;
}): FixedPriceComparison {
  const useFixedPrice = Boolean(input.useFixedPrice);
  const label = resolveFixedPriceLabel(input.fixedPriceLabel);
  const displayMode = resolveFixedPriceDisplayMode(input.fixedPriceDisplayMode);
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
    displayMode,
    calculatedNet,
    customerNet,
    difference,
    estimatedProfit,
    marginPercent,
  };
}

export type FixedPriceSourceFields = {
  useFixedPrice: boolean;
  fixedPriceNet: number | null;
  fixedPriceLabel: string | null;
  fixedPriceDisplayMode: FixedPriceDisplayMode;
};

export function normalizeFixedPriceFields(input: {
  useFixedPrice?: boolean | null;
  fixedPriceNet?: number | null;
  fixedPriceLabel?: string | null;
  fixedPriceDisplayMode?: string | null;
  fallbackLabel?: string | null;
}): FixedPriceSourceFields | { error: string } {
  const useFixedPrice = Boolean(input.useFixedPrice);
  if (!useFixedPrice) {
    return {
      useFixedPrice: false,
      fixedPriceNet: input.fixedPriceNet ?? null,
      fixedPriceLabel: input.fixedPriceLabel?.trim() || null,
      fixedPriceDisplayMode: resolveFixedPriceDisplayMode(input.fixedPriceDisplayMode),
    };
  }

  const raw = input.fixedPriceNet;
  const fixedPriceNet = raw == null ? NaN : Number(raw);
  if (!Number.isFinite(fixedPriceNet) || fixedPriceNet < 0) {
    return { error: "Bitte einen gültigen Festpreis in € angeben (0,00 € ist erlaubt)." };
  }

  return {
    useFixedPrice: true,
    fixedPriceNet,
    fixedPriceLabel: resolveFixedPriceLabel(
      input.fixedPriceLabel?.trim() || input.fallbackLabel
    ),
    fixedPriceDisplayMode: resolveFixedPriceDisplayMode(input.fixedPriceDisplayMode),
  };
}

export interface CustomerDocLine {
  label: string;
  /** null = Betragsspalte leer (Beschreibung ohne Preis). */
  amount: number | null;
  /** Visuell hervorgehobene Festpreis-/Gesamtzeile. */
  emphasis?: boolean;
}

export interface ItemizedSource {
  laborItems: { description: string; totalNet: number; isVisibleToCustomer: boolean }[];
  materialItems: { name: string; totalSalesNet: number; isVisibleToCustomer: boolean }[];
  travelCost: { totalNet: number; isVisibleToCustomer: boolean } | null;
  additionalItems?: {
    description: string;
    totalNet: number;
    isVisibleToCustomer: boolean;
  }[];
  title?: string | null;
}

function collectVisiblePositionLines(source: ItemizedSource): CustomerDocLine[] {
  const lines: CustomerDocLine[] = [];
  for (const l of source.laborItems.filter((x) => x.isVisibleToCustomer)) {
    lines.push({ label: l.description, amount: l.totalNet });
  }
  for (const m of source.materialItems.filter((x) => x.isVisibleToCustomer)) {
    lines.push({ label: m.name, amount: m.totalSalesNet });
  }
  if (source.travelCost?.isVisibleToCustomer) {
    lines.push({ label: "Anfahrt / Fahrtkosten", amount: source.travelCost.totalNet });
  }
  for (const a of (source.additionalItems ?? []).filter((x) => x.isVisibleToCustomer)) {
    lines.push({ label: a.description, amount: a.totalNet });
  }
  return lines;
}

/**
 * Kundensichtbare Dokumentzeilen bei Festpreis inkl. Darstellungsmodus.
 * Interne Positionen werden nicht gelöscht – nur die Kundenausgabe gesteuert.
 */
export function buildFixedPriceDocumentLines(input: {
  fixedPriceNet: number;
  fixedPriceLabel?: string | null;
  fixedPriceDisplayMode?: string | null;
  source: ItemizedSource;
}): CustomerDocLine[] {
  const label = resolveFixedPriceLabel(input.fixedPriceLabel);
  const mode = resolveFixedPriceDisplayMode(input.fixedPriceDisplayMode);
  const amount = Number(input.fixedPriceNet) || 0;
  const positions = collectVisiblePositionLines(input.source);

  if (mode === "SINGLE_LINE" || positions.length === 0) {
    return [{ label, amount, emphasis: true }];
  }

  if (mode === "DESCRIPTION_ONLY") {
    return [
      ...positions.map((p) => ({ label: p.label, amount: null as number | null })),
      { label: `Festpreis gesamt (${label})`, amount, emphasis: true },
    ];
  }

  // POSITIONS_WITH_PRICES: Positionen + optionaler Ausgleich, Summe = Festpreis.
  // Verbindlicher Gesamtbetrag steht in den Dokument-Totals (kein Doppelbetrag).
  const positionSum = positions.reduce((s, p) => s + (p.amount ?? 0), 0);
  const lines = [...positions];
  const delta = Math.round((amount - positionSum) * 100) / 100;
  if (Math.abs(delta) > 0.01) {
    lines.push({
      label:
        delta >= 0
          ? "Pauschalanteil / Leistungsanpassung"
          : "Festpreis-Anpassung",
      amount: delta,
    });
  }
  return lines;
}
