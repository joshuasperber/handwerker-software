"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Vollflächiges Ladefenster für längere Vorgänge (PDF, KI, Speichern …). */
export function LoadingOverlay({
  open,
  label = "Wird geladen …",
  className,
}: {
  open: boolean;
  label?: string;
  className?: string;
}) {
  if (!open) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/30 p-6 backdrop-blur-[4px]",
        className
      )}
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-white/80 bg-white px-6 py-6 shadow-[0_26px_80px_rgba(15,23,42,0.24)]">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0b6268]/8">
          <Loader2 className="h-6 w-6 animate-spin text-[#0b6268]" />
        </span>
        <p className="text-center text-sm font-medium text-slate-800">{label}</p>
      </div>
    </div>
  );
}
