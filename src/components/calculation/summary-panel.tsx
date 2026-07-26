"use client";

import { formatEuro } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { TAX_TREATMENT_SHORT, type TaxTreatment } from "@/lib/tax/treatment";

interface SummaryPanelProps {
  breakdown?: {
    netSalesPrice?: number;
    grossSalesPrice?: number;
    profitAmount?: number;
    riskAmount?: number;
    marginPercent?: number;
    directCosts?: number;
    profitabilityStatus?: string;
    vatAmount?: number;
    taxTreatment?: string;
    isReverseCharge?: boolean;
    useFixedPrice?: boolean;
    fixedPriceLabel?: string;
    fixedPriceNet?: number;
    fixedDifference?: number;
    fixedEstimatedProfit?: number;
    fixedMarginPercent?: number | null;
  } | null;
}

const AMPEL: Record<string, { label: string; className: string }> = {
  profitable: { label: "Profitabel", className: "bg-green-100 text-green-800 border-green-200" },
  tight: { label: "Knapp", className: "bg-amber-100 text-amber-800 border-amber-200" },
  loss: { label: "Verlust / Warnung", className: "bg-red-100 text-red-800 border-red-200" },
  unknown: { label: "–", className: "bg-slate-100 text-slate-600" },
};

export function SummaryPanel({ breakdown }: SummaryPanelProps) {
  const ampel = AMPEL[breakdown?.profitabilityStatus ?? "unknown"];

  return (
    <div className="sticky top-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <h3 className="font-semibold text-slate-900">Kalkulationsübersicht</h3>
      <div className={cn("rounded-lg border px-3 py-2 text-sm font-medium text-center", ampel.className)}>
        {ampel.label}
        {breakdown?.marginPercent != null && (
          <span className="block text-xs mt-0.5">Marge {breakdown.marginPercent.toFixed(1)} %</span>
        )}
      </div>
      <div className="space-y-2 text-sm">
        {breakdown?.taxTreatment && (
          <div className="text-xs font-medium text-slate-600 bg-slate-50 rounded px-2 py-1 text-center">
            {TAX_TREATMENT_SHORT[breakdown.taxTreatment as TaxTreatment] ?? breakdown.taxTreatment}
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-500">Netto</span>
          <span className="font-semibold">{formatEuro(breakdown?.netSalesPrice ?? 0)}</span>
        </div>
        {breakdown?.isReverseCharge || breakdown?.taxTreatment === "REVERSE_CHARGE" ? (
          <div className="flex justify-between">
            <span className="text-slate-500">Rechnungsbetrag</span>
            <span className="font-semibold text-[#0d5c63]">{formatEuro(breakdown?.netSalesPrice ?? 0)}</span>
          </div>
        ) : (
          <div className="flex justify-between">
            <span className="text-slate-500">Brutto</span>
            <span className="font-semibold text-[#0d5c63]">{formatEuro(breakdown?.grossSalesPrice ?? 0)}</span>
          </div>
        )}
        <div className="flex justify-between text-xs text-slate-400 pt-2 border-t">
          <span>Wagnis (intern)</span>
          <span>{formatEuro(breakdown?.riskAmount ?? 0)}</span>
        </div>
        <div className="flex justify-between text-xs text-slate-400">
          <span>Gewinn (intern)</span>
          <span>{formatEuro(breakdown?.profitAmount ?? 0)}</span>
        </div>
        <div className="flex justify-between text-xs text-slate-400">
          <span>Direkte Kosten</span>
          <span>{formatEuro(breakdown?.directCosts ?? 0)}</span>
        </div>
        {breakdown?.useFixedPrice && (
          <div className="text-xs pt-2 border-t space-y-1.5">
            <p className="font-medium text-slate-600">Festpreis an Kunde</p>
            <div className="flex justify-between">
              <span className="text-slate-500">{breakdown.fixedPriceLabel ?? "Festpreis"}</span>
              <span className="font-semibold text-[#0d5c63]">
                {formatEuro(breakdown.fixedPriceNet ?? 0)}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>vs. Kalkulation</span>
              <span>
                {(breakdown.fixedDifference ?? 0) >= 0 ? "+" : ""}
                {formatEuro(breakdown.fixedDifference ?? 0)}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Geschätzter Gewinn</span>
              <span>{formatEuro(breakdown.fixedEstimatedProfit ?? 0)}</span>
            </div>
            {breakdown.fixedMarginPercent != null && (
              <div className="flex justify-between text-slate-400">
                <span>Marge (Festpreis)</span>
                <span>{breakdown.fixedMarginPercent.toFixed(1)} %</span>
              </div>
            )}
          </div>
        )}
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">
        {breakdown?.useFixedPrice
          ? "Festpreis steuert nur Angebot/Rechnung. Die interne Kalkulation bleibt unverändert gespeichert."
          : "Gemeinkosten, Wagnis, Gewinn und Steuerbedarf sind im Endpreis enthalten, werden dem Kunden aber nicht einzeln ausgewiesen."}
      </p>
    </div>
  );
}
