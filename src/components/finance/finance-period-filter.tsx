"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
                "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                preset === value
                  ? "border-[#0d5c63] bg-[#0d5c63] text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              {FINANCE_PERIOD_LABELS[value]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onPresetChange("last_quarter")}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              preset === "last_quarter"
                ? "border-[#0d5c63] bg-[#0d5c63] text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
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
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor="finance-from">Von</Label>
            <Input
              id="finance-from"
              type="date"
              className="min-w-0 w-full"
              value={customFrom}
              onChange={(e) => onCustomFrom(e.target.value)}
            />
          </div>
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor="finance-to">Bis</Label>
            <Input
              id="finance-to"
              type="date"
              className="min-w-0 w-full"
              value={customTo}
              onChange={(e) => onCustomTo(e.target.value)}
            />
          </div>
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
