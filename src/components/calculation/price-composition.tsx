"use client";

import { formatEuro } from "@/lib/utils";

interface PriceCompositionProps {
  calc: {
    netSalesPrice?: number;
    grossSalesPrice?: number;
    laborTotal?: number;
    materialTotal?: number;
    machineTotal?: number;
    procurementTotal?: number;
    travelTotal?: number;
    additionalTotal?: number;
    directCosts?: number;
    overheadAmount?: number;
    riskAmount?: number;
    profitAmount?: number;
    vatAmount?: number;
    useFixedPrice?: boolean;
    fixedPriceNet?: number | null;
    fixedPriceLabel?: string | null;
    laborItems?: { totalNet: number; isVisibleToCustomer: boolean }[];
    materialItems?: { totalSalesNet: number; isVisibleToCustomer: boolean }[];
    travelCost?: { totalNet: number; isVisibleToCustomer: boolean } | null;
  } | null;
  onPreviewInvoice?: () => void;
  onPreviewBreakdown?: () => void;
}

export function PriceCompositionPanel({ calc, onPreviewInvoice, onPreviewBreakdown }: PriceCompositionProps) {
  if (!calc) return null;

  let visibleSum = 0;
  for (const l of calc.laborItems ?? []) {
    if (l.isVisibleToCustomer) visibleSum += l.totalNet;
  }
  for (const m of calc.materialItems ?? []) {
    if (m.isVisibleToCustomer) visibleSum += m.totalSalesNet;
  }
  if (calc.travelCost?.isVisibleToCustomer) visibleSum += calc.travelCost.totalNet;

  const hiddenAmount = Math.max(0, (calc.netSalesPrice ?? 0) - visibleSum);
  const useFixedPrice = Boolean(calc.useFixedPrice);
  const fixedNet =
    useFixedPrice && calc.fixedPriceNet != null ? Number(calc.fixedPriceNet) : null;
  const fixedLabel = calc.fixedPriceLabel?.trim() || "Festpreis";
  const vatRate =
    calc.vatAmount != null && (calc.netSalesPrice ?? 0) > 0
      ? calc.vatAmount / (calc.netSalesPrice ?? 1)
      : 0.19;
  const customerVat =
    useFixedPrice && fixedNet != null
      ? Math.round(fixedNet * vatRate * 100) / 100
      : (calc.vatAmount ?? 0);
  const customerGross =
    useFixedPrice && fixedNet != null
      ? Math.round((fixedNet + customerVat) * 100) / 100
      : (calc.grossSalesPrice ?? 0);

  const steps = [
    { label: "Direkte Kosten", value: calc.directCosts ?? 0, hint: "Arbeit + Material + Maschinen + Beschaffung + Fahrt + Zusatz" },
    { label: "+ Gemeinkosten", value: calc.overheadAmount ?? 0 },
    { label: "+ Wagnis", value: calc.riskAmount ?? 0 },
    { label: "+ Gewinn", value: calc.profitAmount ?? 0, bold: true },
    { label: "= Netto kalkuliert", value: calc.netSalesPrice ?? 0, bold: true, accent: !useFixedPrice },
    ...(useFixedPrice && fixedNet != null
      ? [{ label: `= ${fixedLabel} (Kunde)`, value: fixedNet, bold: true, accent: true }]
      : []),
    { label: "+ USt", value: useFixedPrice ? customerVat : (calc.vatAmount ?? 0) },
    {
      label: "= Brutto",
      value: useFixedPrice ? customerGross : (calc.grossSalesPrice ?? 0),
      bold: true,
      accent: !useFixedPrice,
    },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-slate-900">Wie entsteht die Summe?</h3>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          {useFixedPrice
            ? "Die interne Kalkulation bleibt gespeichert. Am Kunden erscheint nur der gewählte Festpreis."
            : "Maschinen, Beschaffung, Gemeinkosten, Wagnis und Gewinn erscheinen nicht einzeln auf der Kundenrechnung, fließen aber in den Nettopreis ein."}
        </p>
      </div>

      <div className="rounded-lg bg-slate-50 p-3 space-y-1.5 text-sm">
        {steps.map((s) => (
          <div
            key={s.label}
            className={`flex justify-between gap-2 ${s.bold ? "font-semibold pt-1 border-t border-slate-200 first:border-0 first:pt-0" : ""}`}
          >
            <span className={s.accent ? "text-[#0d5c63]" : "text-slate-600"}>{s.label}</span>
            <span className={s.accent ? "text-[#0d5c63]" : ""}>{formatEuro(s.value)}</span>
          </div>
        ))}
      </div>

      {useFixedPrice && fixedNet != null ? (
        <div className="rounded-lg border border-[#0d5c63]/30 bg-[#0d5c63]/5 p-2 text-xs">
          <p className="font-medium text-[#0d5c63]">Kundenposition</p>
          <p className="text-slate-800 mt-0.5">
            {fixedLabel} – {formatEuro(fixedNet)}
          </p>
          <p className="text-slate-500 mt-1">
            Differenz zur Kalkulation: {fixedNet - (calc.netSalesPrice ?? 0) >= 0 ? "+" : ""}
            {formatEuro(fixedNet - (calc.netSalesPrice ?? 0))}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-green-200 bg-green-50 p-2">
            <p className="text-green-800 font-medium">Sichtbar für Kunde</p>
            <p className="text-green-900 font-semibold mt-0.5">{formatEuro(visibleSum)}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
            <p className="text-amber-800 font-medium">In Pauschale enthalten</p>
            <p className="text-amber-900 font-semibold mt-0.5">{formatEuro(hiddenAmount)}</p>
          </div>
        </div>
      )}

      <details className="text-xs text-slate-500">
        <summary className="cursor-pointer font-medium text-slate-700">Kostenblöcke im Detail</summary>
        <ul className="mt-2 space-y-1 pl-2">
          <li>Arbeit: {formatEuro(calc.laborTotal ?? 0)}</li>
          <li>Material: {formatEuro(calc.materialTotal ?? 0)}</li>
          <li>Maschinen: {formatEuro(calc.machineTotal ?? 0)}</li>
          <li>Beschaffung: {formatEuro(calc.procurementTotal ?? 0)}</li>
          <li>Fahrt: {formatEuro(calc.travelTotal ?? 0)}</li>
          <li>Zusatz: {formatEuro(calc.additionalTotal ?? 0)}</li>
        </ul>
      </details>

      <div className="flex flex-wrap gap-2 pt-1">
        {onPreviewInvoice && (
          <button type="button" onClick={onPreviewInvoice} className="text-sm text-[#0d5c63] hover:underline">
            Kundenrechnung anzeigen →
          </button>
        )}
        {onPreviewBreakdown && (
          <button type="button" onClick={onPreviewBreakdown} className="text-sm text-slate-600 hover:underline">
            Interne Aufschlüsselung →
          </button>
        )}
      </div>
    </div>
  );
}
