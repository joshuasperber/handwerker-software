"use client";

import { cn } from "@/lib/utils";
import type { AmountMode } from "@/lib/amount-mode";

export function AmountModeToggle({
  mode,
  onChange,
  className,
}: {
  mode: AmountMode;
  onChange: (mode: AmountMode) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-sm",
        className
      )}
      role="group"
      aria-label="Anzeige Brutto oder Netto — ändert keine gespeicherten Daten"
      title="Nur Anzeigeoption — gespeicherte Beträge bleiben unverändert"
    >
      <button
        type="button"
        onClick={() => onChange("gross")}
        className={cn(
          "rounded-md px-3 py-1.5 font-medium transition-colors",
          mode === "gross"
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-500 hover:text-slate-700"
        )}
      >
        Brutto
      </button>
      <button
        type="button"
        onClick={() => onChange("net")}
        className={cn(
          "rounded-md px-3 py-1.5 font-medium transition-colors",
          mode === "net"
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-500 hover:text-slate-700"
        )}
      >
        Netto
      </button>
    </div>
  );
}
