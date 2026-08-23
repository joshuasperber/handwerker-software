/** Standardfarbe der Rechnungsvorlage (Petrol). */
export const DEFAULT_INVOICE_ACCENT = "#0d5c63";

export const INVOICE_LAYOUTS = ["LOGO_LEFT", "LOGO_RIGHT", "LOGO_CENTER"] as const;
export type InvoiceLayout = (typeof INVOICE_LAYOUTS)[number];

export const INVOICE_FONT_SCALES = ["SMALL", "NORMAL", "LARGE"] as const;
export type InvoiceFontScale = (typeof INVOICE_FONT_SCALES)[number];

export const INVOICE_TEMPLATES = ["STANDARD", "KOMPAKT"] as const;
export type InvoiceTemplate = (typeof INVOICE_TEMPLATES)[number];

export const INVOICE_LAYOUT_LABELS: Record<InvoiceLayout, string> = {
  LOGO_LEFT: "Logo links, Titel rechts",
  LOGO_RIGHT: "Logo rechts, Titel links",
  LOGO_CENTER: "Logo und Titel zentriert",
};

export const INVOICE_FONT_SCALE_LABELS: Record<InvoiceFontScale, string> = {
  SMALL: "Klein",
  NORMAL: "Normal",
  LARGE: "Groß",
};

export const INVOICE_TEMPLATE_LABELS: Record<InvoiceTemplate, string> = {
  STANDARD: "Standard",
  KOMPAKT: "Kompakt",
};

export interface InvoiceDesignSettings {
  invoiceAccentColor: string;
  invoiceLayout: InvoiceLayout;
  invoiceFontScale: InvoiceFontScale;
  invoiceTemplate: InvoiceTemplate;
  invoiceLegalText: string | null;
}

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Normalisiert eine Hex-Farbe, Fallback auf die Standardfarbe. */
export function normalizeHexColor(input: string | null | undefined): string {
  const raw = (input ?? "").trim();
  const match = HEX_RE.exec(raw);
  if (!match) return DEFAULT_INVOICE_ACCENT;
  let hex = match[1];
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return `#${hex.toLowerCase()}`;
}

export function hexToRgb(input: string | null | undefined): { r: number; g: number; b: number } {
  const hex = normalizeHexColor(input).slice(1);
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

/** Hellerer Verlaufston zur Akzentfarbe. */
export function lightenHex(input: string | null | undefined, amount = 0.28): string {
  const { r, g, b } = hexToRgb(input);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const toHex = (c: number) => mix(c).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function parseInvoiceLayout(value: string | null | undefined): InvoiceLayout {
  return INVOICE_LAYOUTS.includes(value as InvoiceLayout) ? (value as InvoiceLayout) : "LOGO_LEFT";
}

export function parseInvoiceFontScale(value: string | null | undefined): InvoiceFontScale {
  return INVOICE_FONT_SCALES.includes(value as InvoiceFontScale)
    ? (value as InvoiceFontScale)
    : "NORMAL";
}

export function parseInvoiceTemplate(value: string | null | undefined): InvoiceTemplate {
  return INVOICE_TEMPLATES.includes(value as InvoiceTemplate)
    ? (value as InvoiceTemplate)
    : "STANDARD";
}

export function resolveInvoiceDesign(input: {
  invoiceAccentColor?: string | null;
  invoiceLayout?: string | null;
  invoiceFontScale?: string | null;
  invoiceTemplate?: string | null;
  invoiceLegalText?: string | null;
}): InvoiceDesignSettings {
  return {
    invoiceAccentColor: normalizeHexColor(input.invoiceAccentColor),
    invoiceLayout: parseInvoiceLayout(input.invoiceLayout),
    invoiceFontScale: parseInvoiceFontScale(input.invoiceFontScale),
    invoiceTemplate: parseInvoiceTemplate(input.invoiceTemplate),
    invoiceLegalText: input.invoiceLegalText?.trim() ? input.invoiceLegalText.trim() : null,
  };
}

export function fontScaleFactor(scale: InvoiceFontScale): number {
  if (scale === "SMALL") return 0.9;
  if (scale === "LARGE") return 1.12;
  return 1;
}

/**
 * Firmendaten/Design aus den aktuellen Einstellungen über ein bestehendes Snapshot legen.
 * Beträge und Positionen bleiben unverändert — nur Darstellung und Absendertexte wechseln.
 */
export function overlayCompanyPresentation<T extends { company: Record<string, unknown>; calc: unknown; amounts: unknown }>(
  snapshot: T,
  currentCompany: Record<string, unknown>
): T {
  return {
    ...snapshot,
    company: { ...snapshot.company, ...currentCompany },
  };
}
