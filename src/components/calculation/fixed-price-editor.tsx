"use client";

import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { formatEuro } from "@/lib/utils";
import {
  FIXED_PRICE_DISPLAY_MODES,
  FIXED_PRICE_LABEL_PRESETS,
  compareFixedPrice,
  type FixedPriceDisplayMode,
} from "@/lib/calculation/fixed-price";

export interface FixedPriceEditorProps {
  useFixedPrice: boolean;
  fixedPriceNet: number | null | undefined;
  fixedPriceLabel: string | null | undefined;
  fixedPriceDisplayMode?: FixedPriceDisplayMode | string | null;
  calculatedNet: number;
  profitAmount: number;
  directCosts: number;
  onChange: (next: {
    useFixedPrice: boolean;
    fixedPriceNet: number | null;
    fixedPriceLabel: string | null;
    fixedPriceDisplayMode: FixedPriceDisplayMode;
  }) => void;
}

export function FixedPriceEditor({
  useFixedPrice,
  fixedPriceNet,
  fixedPriceLabel,
  fixedPriceDisplayMode = "SINGLE_LINE",
  calculatedNet,
  profitAmount,
  directCosts,
  onChange,
}: FixedPriceEditorProps) {
  const displayMode =
    fixedPriceDisplayMode === "POSITIONS_WITH_PRICES" ||
    fixedPriceDisplayMode === "DESCRIPTION_ONLY"
      ? fixedPriceDisplayMode
      : "SINGLE_LINE";

  const comparison = compareFixedPrice({
    useFixedPrice,
    fixedPriceNet,
    fixedPriceLabel,
    fixedPriceDisplayMode: displayMode,
    calculatedNet,
    profitAmount,
    directCosts,
  });

  const labelValue = fixedPriceLabel ?? "";

  function emit(partial: {
    useFixedPrice?: boolean;
    fixedPriceNet?: number | null;
    fixedPriceLabel?: string | null;
    fixedPriceDisplayMode?: FixedPriceDisplayMode;
  }) {
    onChange({
      useFixedPrice: partial.useFixedPrice ?? useFixedPrice,
      fixedPriceNet:
        partial.fixedPriceNet !== undefined ? partial.fixedPriceNet : (fixedPriceNet ?? null),
      fixedPriceLabel:
        partial.fixedPriceLabel !== undefined
          ? partial.fixedPriceLabel
          : (fixedPriceLabel ?? null),
      fixedPriceDisplayMode: partial.fixedPriceDisplayMode ?? displayMode,
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4 space-y-4 mt-4">
      <div>
        <h3 className="font-medium text-slate-900">Kundenabrechnung</h3>
        <p className="text-xs text-slate-500 mt-1">
          Entscheiden Sie, ob Angebot/Rechnung mit Einzelpositionen oder einem verbindlichen
          Festpreis abgerechnet wird. Die interne Kalkulation bleibt in beiden Fällen erhalten und
          bearbeitbar.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name="billingMode"
            className="mt-1"
            checked={!useFixedPrice}
            onChange={() =>
              emit({
                useFixedPrice: false,
              })
            }
          />
          <span>
            <span className="font-medium">Einzelpositionen verwenden</span>
            <span className="block text-xs text-slate-500">
              Sichtbare Positionen wie bisher auf dem Dokument
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name="billingMode"
            className="mt-1"
            checked={useFixedPrice}
            onChange={() =>
              emit({
                useFixedPrice: true,
                fixedPriceNet:
                  fixedPriceNet != null && Number.isFinite(fixedPriceNet)
                    ? fixedPriceNet
                    : calculatedNet,
                fixedPriceLabel: fixedPriceLabel?.trim() || "Pauschalpreis",
              })
            }
          />
          <span>
            <span className="font-medium">Festpreis verwenden</span>
            <span className="block text-xs text-slate-500">
              Verbindlicher Kundenpreis; interne Positionen bleiben zur Kontrolle
            </span>
          </span>
        </label>
      </div>

      {useFixedPrice && (
        <div className="space-y-3 rounded-lg bg-slate-50 p-3">
          <div>
            <label className="text-xs font-medium text-slate-600">
              Bezeichnung auf dem Dokument
            </label>
            <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2">
              {FIXED_PRICE_LABEL_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`text-xs px-2 py-1 rounded border ${
                    labelValue === preset
                      ? "border-[#0d5c63] bg-[#0d5c63]/10 text-[#0d5c63]"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                  onClick={() =>
                    emit({
                      useFixedPrice: true,
                      fixedPriceNet: fixedPriceNet ?? calculatedNet,
                      fixedPriceLabel: preset,
                    })
                  }
                >
                  {preset}
                </button>
              ))}
            </div>
            <Input
              value={labelValue}
              placeholder="z. B. Pauschalpreis für Türmontage inklusive Material"
              onChange={(e) =>
                emit({
                  useFixedPrice: true,
                  fixedPriceNet: fixedPriceNet ?? calculatedNet,
                  fixedPriceLabel: e.target.value,
                })
              }
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Festpreis (netto, €)</label>
            <NumberInput
              className="mt-1"
              required
              min={0}
              value={
                fixedPriceNet != null && Number.isFinite(fixedPriceNet)
                  ? fixedPriceNet
                  : calculatedNet
              }
              suffix="€"
              onValueChange={(v) =>
                emit({
                  useFixedPrice: true,
                  fixedPriceNet: v,
                  fixedPriceLabel: fixedPriceLabel?.trim() || "Pauschalpreis",
                })
              }
            />
            <p className="text-xs text-slate-500 mt-1">
              Verbindlicher Kundenbetrag: {formatEuro(comparison.customerNet)}
              {fixedPriceNet === 0 && " (0,00 € ist erlaubt)"}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-600 mb-2">Darstellung auf Angebot/Rechnung</p>
            <div className="space-y-2">
              {FIXED_PRICE_DISPLAY_MODES.map((mode) => (
                <label
                  key={mode.value}
                  className={`flex items-start gap-2 rounded-lg border p-2.5 text-sm cursor-pointer ${
                    displayMode === mode.value
                      ? "border-[#0d5c63] bg-white"
                      : "border-slate-200 bg-white/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="fixedPriceDisplayMode"
                    className="mt-1"
                    checked={displayMode === mode.value}
                    onChange={() =>
                      emit({
                        useFixedPrice: true,
                        fixedPriceDisplayMode: mode.value,
                      })
                    }
                  />
                  <span>
                    <span className="font-medium">{mode.label}</span>
                    <span className="block text-xs text-slate-500">{mode.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm pt-1">
            <div className="rounded border border-slate-200 bg-white p-2">
              <p className="text-xs text-slate-500">Kalkulierte Kosten (Netto)</p>
              <p className="font-semibold">{formatEuro(comparison.calculatedNet)}</p>
            </div>
            <div className="rounded border border-slate-200 bg-white p-2">
              <p className="text-xs text-slate-500">Festpreis (Netto)</p>
              <p className="font-semibold">{formatEuro(comparison.customerNet)}</p>
            </div>
            <div className="rounded border border-slate-200 bg-white p-2">
              <p className="text-xs text-slate-500">Differenz</p>
              <p
                className={`font-semibold ${
                  comparison.difference >= 0 ? "text-green-700" : "text-red-700"
                }`}
              >
                {comparison.difference >= 0 ? "+" : ""}
                {formatEuro(comparison.difference)}
              </p>
            </div>
            <div className="rounded border border-slate-200 bg-white p-2">
              <p className="text-xs text-slate-500">Geschätzter Gewinn</p>
              <p
                className={`font-semibold ${
                  comparison.estimatedProfit >= 0 ? "text-green-700" : "text-red-700"
                }`}
              >
                {formatEuro(comparison.estimatedProfit)}
              </p>
            </div>
            {comparison.marginPercent != null && (
              <div className="rounded border border-slate-200 bg-white p-2 col-span-2">
                <p className="text-xs text-slate-500">Marge (Festpreis vs. direkte Kosten)</p>
                <p className="font-semibold">{comparison.marginPercent.toFixed(1)} %</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
