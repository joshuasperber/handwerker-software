import {
  type DocumentCalcInput,
  calcVisibleLinesSum,
  calcHiddenAmount,
} from "./build-document-html";
import { buildFixedPriceDocumentLines } from "@/lib/calculation/fixed-price";
import { buildLaborCustomerLines } from "@/lib/calculation/labor-costs";

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
    return buildFixedPriceDocumentLines({
      fixedPriceNet: calc.netSalesPrice,
      fixedPriceLabel: calc.fixedPriceLabel,
      fixedPriceDisplayMode: calc.fixedPriceDisplayMode,
      source: calc,
    })
      .filter((l) => l.amount != null)
      .map((l) => ({ label: l.label, amount: l.amount as number }));
  }

  const lines: DocLine[] = [];

  for (const l of buildLaborCustomerLines(calc.laborInvoiceMode, calc.laborItems, {
    useFixedPrice: false,
  })) {
    lines.push(l);
  }
  for (const m of calc.materialItems.filter((x) => x.isVisibleToCustomer)) {
    lines.push({ label: m.name, amount: m.totalSalesNet });
  }
  if (calc.travelCost?.isVisibleToCustomer) {
    lines.push({ label: "Anfahrt / Fahrtkosten", amount: calc.travelCost.totalNet });
  }
  for (const a of (calc.additionalItems ?? []).filter((x) => x.isVisibleToCustomer)) {
    lines.push({ label: a.description, amount: a.totalNet });
  }

  const hiddenAmount = calcHiddenAmount(calc);
  if (lines.length === 0 && calc.netSalesPrice !== 0) {
    lines.push({ label: calc.title ?? "Leistungspauschale", amount: calc.netSalesPrice });
  } else if (Math.abs(hiddenAmount) > 0.01) {
    lines.push({
      label: "Projektpauschale (Gemeinkosten, Wagnis & Gewinn)",
      amount: hiddenAmount,
    });
  }

  return lines;
}

export { calcVisibleLinesSum };
