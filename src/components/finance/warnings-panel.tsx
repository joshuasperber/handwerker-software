"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { FinanceWarning } from "@/lib/finance/types";
import { FINANCE_DISCLAIMERS } from "@/lib/finance/types";
import { AlertTriangle, Info } from "lucide-react";

export function FinanceWarningsPanel({ warnings }: { warnings: FinanceWarning[] }) {
  if (warnings.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">Hinweise &amp; Warnungen</h3>
        <p className="text-sm text-slate-500">
          Keine Hinweise für diesen Zeitraum. Alle Hinweise sind unverbindliche Orientierung.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">Hinweise &amp; Warnungen</h3>
        <span className="text-[11px] text-slate-400">unverbindlich</span>
      </div>
      {warnings.map((w) => (
        <Alert
          key={w.id}
          className={
            w.severity === "warning"
              ? "border-amber-200 bg-amber-50/80"
              : "border-slate-200 bg-slate-50/80"
          }
        >
          {w.severity === "warning" ? (
            <AlertTriangle className="text-amber-600" />
          ) : (
            <Info className="text-[#0d5c63]" />
          )}
          <AlertTitle className="text-sm">{w.title}</AlertTitle>
          <AlertDescription className="text-slate-600">{w.message}</AlertDescription>
        </Alert>
      ))}
      <p className="text-[11px] text-slate-400 pt-1">{FINANCE_DISCLAIMERS.estimatesOnly}</p>
    </div>
  );
}
