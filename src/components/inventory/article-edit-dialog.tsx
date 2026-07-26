"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { Pencil } from "lucide-react";
import {
  ARTICLE_UNITS,
  CUSTOM_UNIT_VALUE,
  isPresetUnit,
  normalizeUnitLabel,
} from "@/lib/inventory/units";

export interface EditableArticle {
  id: string;
  name: string;
  sku?: string | null;
  unit: string;
  category?: string | null;
  description?: string | null;
  packageSize?: number;
  minimumStock?: number;
  targetStock?: number;
  purchasePriceNet?: number | null;
  salesPriceNet?: number | null;
  supplierName?: string | null;
  isActive?: boolean;
}

interface ArticleEditDialogProps {
  article: EditableArticle | null;
  onClose: () => void;
  onSuccess: () => void;
}

function UnitSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (unit: string) => void;
}) {
  const normalized = normalizeUnitLabel(value);
  const isCustom = !isPresetUnit(normalized);
  const [custom, setCustom] = useState(isCustom ? value : "");

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Einheit</label>
      <select
        className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
        value={isCustom ? CUSTOM_UNIT_VALUE : normalized}
        onChange={(e) => {
          if (e.target.value === CUSTOM_UNIT_VALUE) {
            onChange(custom || "sonstige Einheit");
          } else {
            onChange(e.target.value);
          }
        }}
      >
        {ARTICLE_UNITS.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
        <option value={CUSTOM_UNIT_VALUE}>sonstige Einheit…</option>
      </select>
      {(isCustom || value === CUSTOM_UNIT_VALUE) && (
        <Input
          label="Eigene Einheit"
          value={isCustom ? value : custom}
          onChange={(e) => {
            setCustom(e.target.value);
            onChange(e.target.value || "sonstige Einheit");
          }}
          placeholder="z. B. Rolle, Beutel"
        />
      )}
    </div>
  );
}

function ArticleEditDialogContent({
  article,
  onClose,
  onSuccess,
}: {
  article: EditableArticle;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    name: article.name,
    sku: article.sku ?? "",
    unit: normalizeUnitLabel(article.unit),
    category: article.category ?? "",
    description: article.description ?? "",
    packageSize: article.packageSize ?? 1,
    minimumStock: article.minimumStock ?? 0,
    targetStock: article.targetStock ?? 0,
    purchasePriceNet: article.purchasePriceNet ?? (null as number | null),
    salesPriceNet: article.salesPriceNet ?? (null as number | null),
    supplierName: article.supplierName ?? "",
  });
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setMsg("Artikelname ist Pflicht.");
      return;
    }
    setSaving(true);
    setMsg("");
    const res = await fetch(`/api/articles/${article.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        unit: form.unit.trim() || "Stück",
        category: form.category.trim() || null,
        description: form.description.trim() || null,
        packageSize: form.packageSize,
        minimumStock: form.minimumStock,
        targetStock: form.targetStock,
        purchasePriceNet: form.purchasePriceNet,
        salesPriceNet: form.salesPriceNet,
        supplierName: form.supplierName.trim() || null,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) {
      onSuccess();
      onClose();
    } else {
      setMsg(data.error ?? "Speichern fehlgeschlagen");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Pencil className="h-5 w-5 text-[#0d5c63]" /> Artikel bearbeiten
        </h3>

        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label="Artikelname *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <Input
            label="Kategorie"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
          <Input
            label="Artikelnr. / SKU"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
          />
          <UnitSelect
            value={form.unit}
            onChange={(unit) => setForm({ ...form, unit })}
          />
          <NumberInput
            label={`Verpackungsgröße (${form.unit || "Einheit"} pro Gebinde)`}
            min={0.001}
            value={form.packageSize}
            onValueChange={(v) => setForm({ ...form, packageSize: v ?? 1 })}
          />
          <NumberInput
            label="Einkaufspreis netto"
            suffix="€"
            min={0}
            value={form.purchasePriceNet}
            onValueChange={(v) => setForm({ ...form, purchasePriceNet: v })}
          />
          <NumberInput
            label="Kalkulationspreis netto"
            suffix="€"
            min={0}
            value={form.salesPriceNet}
            onValueChange={(v) => setForm({ ...form, salesPriceNet: v })}
          />
          <p className="sm:col-span-2 text-xs text-slate-400 -mt-1">
            Der Kalkulationspreis wird in der Kalkulation übernommen (sonst der Einkaufspreis). Dort weiterhin manuell änderbar.
          </p>
          <NumberInput
            label="Mindestbestand"
            min={0}
            value={form.minimumStock}
            onValueChange={(v) => setForm({ ...form, minimumStock: v ?? 0 })}
          />
          <NumberInput
            label="Zielbestand"
            min={0}
            value={form.targetStock}
            onValueChange={(v) => setForm({ ...form, targetStock: v ?? 0 })}
          />
          <div className="sm:col-span-2">
            <Input
              label="Lieferant"
              value={form.supplierName}
              onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Textarea
              label="Beschreibung (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>

          {msg && <p className="sm:col-span-2 text-sm text-red-600">{msg}</p>}

          <div className="sm:col-span-2 flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Abbrechen
            </Button>
            <Button type="submit" variant="action" disabled={saving}>
              {saving ? "Speichern…" : "Speichern"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ArticleEditDialog({ article, onClose, onSuccess }: ArticleEditDialogProps) {
  if (!article) return null;
  return (
    <ArticleEditDialogContent
      key={article.id}
      article={article}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}
