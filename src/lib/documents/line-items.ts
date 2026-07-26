import {
  type DocumentCalcInput,
  calcVisibleLinesSum,
  calcHiddenAmount,
} from "./build-document-html";
import { resolveFixedPriceLabel } from "@/lib/calculation/fixed-price";

export interface DocLine {
  label: string;
  amount: number;
}

/**
 * Liefert die kundensichtbaren Positionen eines Dokuments (gleiche Logik wie die
 * HTML-Darstellung), zur Wiederverwendung in PDF- und E-Rechnungs-Erzeugung.
 */
export function getVisibleLineItems(calc: DocumentCalcInput): DocLine[] {
  if (calc.useFixedPrice) {
    const label = resolveFixedPriceLabel(calc.fixedPriceLabel);
    return [{ label: `${label} – ${formatFixedPriceAmount(calc.netSalesPrice)}`, amount: calc.netSalesPrice }];
  }

  const lines: DocLine[] = [];

  for (const l of calc.laborItems.filter((x) => x.isVisibleToCustomer)) {
    lines.push({ label: l.description, amount: l.totalNet });
  }
  for (const m of calc.materialItems.filter((x) => x.isVisibleToCustomer)) {
    lines.push({ label: m.name, amount: m.totalSalesNet });
  }
  if (calc.travelCost?.isVisibleToCustomer) {
    lines.push({ label: "Anfahrt / Fahrtkosten", amount: calc.travelCost.totalNet });
  }

  const hiddenAmount = calcHiddenAmount(calc);
  if (lines.length === 0 && calc.netSalesPrice !== 0) {
    lines.push({ label: calc.title ?? "Leistungspauschale", amount: calc.netSalesPrice });
  } else if (Math.abs(hiddenAmount) > 0.01) {
    lines.push({
      label:
        "Projektpauschale (Material, Maschinen, Beschaffung, Gemeinkosten, Wagnis & Gewinn)",
      amount: hiddenAmount,
    });
  }

  return lines;
}

/** Kompakte Euro-Darstellung für die Positionsbezeichnung „Festpreis – X €“. */
function formatFixedPriceAmount(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export { calcVisibleLinesSum };
