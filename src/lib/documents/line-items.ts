import {
  type DocumentCalcInput,
  calcVisibleLinesSum,
  calcHiddenAmount,
} from "./build-document-html";

export interface DocLine {
  label: string;
  amount: number;
}

/**
 * Liefert die kundensichtbaren Positionen eines Dokuments (gleiche Logik wie die
 * HTML-Darstellung), zur Wiederverwendung in PDF- und E-Rechnungs-Erzeugung.
 */
export function getVisibleLineItems(calc: DocumentCalcInput): DocLine[] {
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

export { calcVisibleLinesSum };
