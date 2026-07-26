"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { ARTICLE_UNITS } from "@/lib/inventory/units";
import { articlePriceForCalculation } from "@/lib/inventory/units";
import { formatEuro } from "@/lib/utils";
import { Plus, Trash2, Package } from "lucide-react";

export type EditableMaterialLine = {
  key: string;
  articleId: string | null;
  sourceServiceId?: string | null;
  name: string;
  quantityRequired: number;
  unit: string;
  unitPriceNet: number | null;
  notes: string;
  isTool?: boolean;
  stockAvailable?: number | null;
};

export type InventoryArticleOption = {
  id: string;
  name: string;
  unit: string;
  purchasePriceNet?: number | null;
  salesPriceNet?: number | null;
  totals?: { available?: number };
};

interface OrderMaterialEditorProps {
  lines: EditableMaterialLine[];
  articles: InventoryArticleOption[];
  onChange: (lines: EditableMaterialLine[]) => void;
  /** Kompaktere Darstellung für Mobile/Assisten */
  compact?: boolean;
}

function newKey() {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyMaterialLine(): EditableMaterialLine {
  return {
    key: newKey(),
    articleId: null,
    name: "",
    quantityRequired: 1,
    unit: "Stück",
    unitPriceNet: null,
    notes: "",
  };
}

export function materialLineFromArticle(article: InventoryArticleOption): EditableMaterialLine {
  return {
    key: newKey(),
    articleId: article.id,
    name: article.name,
    quantityRequired: 1,
    unit: article.unit || "Stück",
    unitPriceNet: articlePriceForCalculation(article),
    notes: "",
    stockAvailable: article.totals?.available ?? null,
  };
}

export function OrderMaterialEditor({
  lines,
  articles,
  onChange,
  compact,
}: OrderMaterialEditorProps) {
  function updateLine(key: string, patch: Partial<EditableMaterialLine>) {
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    onChange(lines.filter((l) => l.key !== key));
  }

  function addFromArticle(articleId: string) {
    const article = articles.find((a) => a.id === articleId);
    if (!article) return;
    onChange([...lines, materialLineFromArticle(article)]);
  }

  function addFree() {
    onChange([...lines, createEmptyMaterialLine()]);
  }

  const totalNet = lines.reduce(
    (s, l) => s + (Number(l.unitPriceNet) || 0) * (Number(l.quantityRequired) || 0),
    0
  );

  return (
    <div className="space-y-4">
      <div className={`flex flex-col gap-2 ${compact ? "" : "sm:flex-row sm:items-end"}`}>
        <div className="flex-1 min-w-0">
          <label className="text-sm font-medium">Aus Inventar hinzufügen</label>
          <select
            className="w-full h-10 rounded-lg border mt-1 px-3 text-sm"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                addFromArticle(e.target.value);
                e.target.value = "";
              }
            }}
          >
            <option value="">Artikel wählen…</option>
            {articles.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.totals?.available != null
                  ? ` · Bestand ${a.totals.available} ${a.unit}`
                  : ""}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addFree} className="shrink-0">
          <Plus className="h-4 w-4 mr-1" /> Freies Material
        </Button>
      </div>

      {!articles.length && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          Keine Inventarartikel geladen – Sie können Material als freie Position erfassen.
        </p>
      )}

      <div className="space-y-3">
        {lines.map((line) => (
          <div
            key={line.key}
            className="rounded-xl border border-slate-200 p-3 space-y-3 bg-white"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0 space-y-3">
                <Input
                  label="Material *"
                  value={line.name}
                  onChange={(e) => updateLine(line.key, { name: e.target.value })}
                  placeholder="Bezeichnung"
                />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <NumberInput
                    label="Menge *"
                    min={0}
                    value={line.quantityRequired}
                    onValueChange={(v) =>
                      updateLine(line.key, { quantityRequired: v && v > 0 ? v : 1 })
                    }
                  />
                  <div>
                    <label className="text-sm font-medium">Einheit</label>
                    <select
                      className="w-full h-10 rounded-lg border mt-1 px-2 text-sm"
                      value={
                        (ARTICLE_UNITS as readonly string[]).includes(line.unit)
                          ? line.unit
                          : "__custom__"
                      }
                      onChange={(e) => {
                        if (e.target.value === "__custom__") return;
                        updateLine(line.key, { unit: e.target.value });
                      }}
                    >
                      {ARTICLE_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                      <option value="__custom__">Andere…</option>
                    </select>
                    {!(ARTICLE_UNITS as readonly string[]).includes(line.unit) && (
                      <Input
                        className="mt-1"
                        value={line.unit}
                        onChange={(e) => updateLine(line.key, { unit: e.target.value })}
                        placeholder="Einheit"
                      />
                    )}
                  </div>
                  <NumberInput
                    label="Preis netto"
                    suffix="€"
                    min={0}
                    value={line.unitPriceNet}
                    onValueChange={(v) => updateLine(line.key, { unitPriceNet: v })}
                  />
                  <div className="flex flex-col justify-end text-xs text-slate-500 pb-2">
                    {line.articleId ? (
                      <span className="inline-flex items-center gap-1">
                        <Package className="h-3.5 w-3.5" />
                        Inventar
                        {line.stockAvailable != null ? ` · ${line.stockAvailable}` : ""}
                      </span>
                    ) : (
                      <span>Freie Position</span>
                    )}
                    <span className="font-medium text-slate-700 mt-0.5">
                      = {formatEuro((line.unitPriceNet ?? 0) * (line.quantityRequired || 0))}
                    </span>
                  </div>
                </div>
                <Input
                  label="Notiz (optional)"
                  value={line.notes}
                  onChange={(e) => updateLine(line.key, { notes: e.target.value })}
                />
              </div>
              <button
                type="button"
                className="text-red-500 hover:text-red-700 mt-7 shrink-0 p-2"
                aria-label="Materialposition löschen"
                onClick={() => removeLine(line.key)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {!lines.length && (
          <p className="text-sm text-slate-500 text-center py-4 border border-dashed border-slate-200 rounded-xl">
            Noch kein Material – aus Inventar wählen oder freie Position hinzufügen.
          </p>
        )}
      </div>

      {lines.length > 0 && (
        <p className="text-sm text-right text-slate-600">
          Material summiert (netto): <strong className="text-[#0d5c63]">{formatEuro(totalNet)}</strong>
        </p>
      )}
    </div>
  );
}
