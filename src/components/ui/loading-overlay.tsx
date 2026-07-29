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
        "fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/35 backdrop-blur-[2px] p-6",
        className
      )}
    >
      <div className="flex max-w-sm w-full flex-col items-center gap-3 rounded-2xl bg-white px-6 py-5 shadow-xl border border-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-[#0d5c63]" />
        <p className="text-sm font-medium text-slate-800 text-center">{label}</p>
      </div>
    </div>
  );
}
