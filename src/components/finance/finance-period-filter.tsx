"use client";

import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { FinancePeriodPreset } from "@/lib/finance/types";
import { FINANCE_PERIOD_LABELS } from "@/lib/finance/period";
import { cn } from "@/lib/utils";

const PRIMARY_PRESETS: FinancePeriodPreset[] = [
  "current_month",
  "last_month",
  "current_quarter",
  "current_year",
  "custom",
];

export function FinancePeriodFilter({
  preset,
  onPresetChange,
  customFrom,
  customTo,
  onCustomFrom,
  onCustomTo,
  canNavigateMonths,
  onShiftMonth,
  periodLabel,
}: {
  preset: FinancePeriodPreset;
  onPresetChange: (preset: FinancePeriodPreset) => void;
  customFrom: string;
  customTo: string;
  onCustomFrom: (value: string) => void;
  onCustomTo: (value: string) => void;
  canNavigateMonths: boolean;
  onShiftMonth: (delta: number) => void;
  periodLabel?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          disabled={!canNavigateMonths}
          onClick={() => onShiftMonth(-1)}
          aria-label="Vorheriger Monat"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
          {PRIMARY_PRESETS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onPresetChange(value)}
              className={cn(
                "shrink-0 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-200 active:scale-[.98]",
                preset === value
                  ? "border-[#0d5c63] bg-[#0d5c63] text-white shadow-[0_6px_16px_rgba(13,92,99,0.18)]"
                  : "border-slate-200 bg-white text-slate-600 shadow-sm hover:border-[#0d5c63]/30 hover:bg-[#0d5c63]/[0.04] hover:text-[#0d5c63]"
              )}
            >
              {FINANCE_PERIOD_LABELS[value]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onPresetChange("last_quarter")}
            className={cn(
              "shrink-0 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-200 active:scale-[.98]",
              preset === "last_quarter"
                ? "border-[#0d5c63] bg-[#0d5c63] text-white shadow-[0_6px_16px_rgba(13,92,99,0.18)]"
                : "border-slate-200 bg-white text-slate-600 shadow-sm hover:border-[#0d5c63]/30 hover:bg-[#0d5c63]/[0.04] hover:text-[#0d5c63]"
            )}
          >
            {FINANCE_PERIOD_LABELS.last_quarter}
          </button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          disabled={!canNavigateMonths}
          onClick={() => onShiftMonth(1)}
          aria-label="Nächster Monat"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {preset === "custom" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DateInput
            id="finance-from"
            label="Von"
            value={customFrom}
            onValueChange={onCustomFrom}
          />
          <DateInput
            id="finance-to"
            label="Bis"
            value={customTo}
            onValueChange={onCustomTo}
          />
        </div>
      )}

      {periodLabel && (
        <p className="text-xs text-slate-500">
          Ausgewerteter Zeitraum: <strong className="text-slate-700">{periodLabel}</strong>
        </p>
      )}
    </div>
  );
}
