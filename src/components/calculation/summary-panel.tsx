"use client";

import { formatEuro } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface SummaryPanelProps {
  breakdown?: {
    netSalesPrice?: number;
    grossSalesPrice?: number;
    profitAmount?: number;
    riskAmount?: number;
    marginPercent?: number;
    directCosts?: number;
    profitabilityStatus?: string;
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
        <div className="flex justify-between">
          <span className="text-slate-500">Netto</span>
          <span className="font-semibold">{formatEuro(breakdown?.netSalesPrice ?? 0)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Brutto</span>
          <span className="font-semibold text-[#0d5c63]">{formatEuro(breakdown?.grossSalesPrice ?? 0)}</span>
        </div>
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
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">
        Gemeinkosten, Wagnis, Gewinn und Steuerbedarf sind im Endpreis enthalten, werden dem Kunden aber nicht einzeln ausgewiesen.
      </p>
    </div>
  );
}
