"use client";

import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { formatEuro } from "@/lib/utils";
import {
  FIXED_PRICE_LABEL_PRESETS,
  compareFixedPrice,
} from "@/lib/calculation/fixed-price";

export interface FixedPriceEditorProps {
  useFixedPrice: boolean;
  fixedPriceNet: number | null | undefined;
  fixedPriceLabel: string | null | undefined;
  calculatedNet: number;
  profitAmount: number;
  directCosts: number;
  onChange: (next: {
    useFixedPrice: boolean;
    fixedPriceNet: number | null;
    fixedPriceLabel: string | null;
  }) => void;
}

export function FixedPriceEditor({
  useFixedPrice,
  fixedPriceNet,
  fixedPriceLabel,
  calculatedNet,
  profitAmount,
  directCosts,
  onChange,
}: FixedPriceEditorProps) {
  const comparison = compareFixedPrice({
    useFixedPrice,
    fixedPriceNet,
    fixedPriceLabel,
    calculatedNet,
    profitAmount,
    directCosts,
  });

  const labelValue = fixedPriceLabel ?? "";

  return (
    <div className="rounded-lg border border-slate-200 p-4 space-y-4 mt-4">
      <div>
        <h3 className="font-medium text-slate-900">Kundenabrechnung</h3>
        <p className="text-xs text-slate-500 mt-1">
          Entscheiden Sie bewusst, ob das Angebot bzw. die Rechnung Einzelpositionen oder einen Festpreis zeigt.
          Die interne Kalkulation bleibt in beiden Fällen erhalten.
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
              onChange({
                useFixedPrice: false,
                fixedPriceNet: fixedPriceNet ?? null,
                fixedPriceLabel: fixedPriceLabel ?? null,
              })
            }
          />
          <span>
            <span className="font-medium">Einzelpositionen verwenden</span>
            <span className="block text-xs text-slate-500">Sichtbare Positionen wie bisher auf dem Dokument</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name="billingMode"
            className="mt-1"
            checked={useFixedPrice}
            onChange={() =>
              onChange({
                useFixedPrice: true,
                fixedPriceNet:
                  fixedPriceNet != null && Number.isFinite(fixedPriceNet)
                    ? fixedPriceNet
                    : calculatedNet,
                fixedPriceLabel: fixedPriceLabel?.trim() || "Festpreis",
              })
            }
          />
          <span>
            <span className="font-medium">Festpreis verwenden</span>
            <span className="block text-xs text-slate-500">Eine Position für den Kunden, Kalkulation intern weiter sichtbar</span>
          </span>
        </label>
      </div>

      {useFixedPrice && (
        <div className="space-y-3 rounded-lg bg-slate-50 p-3">
          <div>
            <label className="text-xs font-medium text-slate-600">Bezeichnung auf dem Dokument</label>
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
                    onChange({
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
              placeholder="Eigener Text, z. B. Pauschale Sanierung"
              onChange={(e) =>
                onChange({
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
              value={fixedPriceNet ?? calculatedNet}
              suffix="€"
              min={0}
              onValueChange={(v) =>
                onChange({
                  useFixedPrice: true,
                  fixedPriceNet: v,
                  fixedPriceLabel: fixedPriceLabel ?? "Festpreis",
                })
              }
            />
            <p className="text-xs text-slate-500 mt-1">
              Auf dem Dokument: „{comparison.label} – {formatEuro(comparison.customerNet)}“
            </p>
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
