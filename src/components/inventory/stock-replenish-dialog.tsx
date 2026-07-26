"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { PackagePlus } from "lucide-react";
import { toast } from "sonner";

export interface ReplenishArticle {
  id: string;
  name: string;
  unit: string;
  purchasePriceNet?: number | null;
  supplierName?: string | null;
  stockBalances?: { storageLocationId: string; onHandQuantity: number }[];
}

interface LocationOption {
  id: string;
  name: string;
  locationType: string;
}

interface StockReplenishDialogProps {
  article: ReplenishArticle | null;
  locations: LocationOption[];
  defaultLocationId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

function todayInputValue() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function StockReplenishDialogContent({
  article,
  locations,
  defaultLocationId,
  onClose,
  onSuccess,
}: {
  article: ReplenishArticle;
  locations: LocationOption[];
  defaultLocationId?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const haupt = locations.find((l) => l.locationType === "HAUPTLAGER");
  const [locationId, setLocationId] = useState(
    defaultLocationId ?? haupt?.id ?? locations[0]?.id ?? ""
  );
  const [quantity, setQuantity] = useState<number | null>(1);
  const [purchasePriceNet, setPurchasePriceNet] = useState<number | null>(
    article.purchasePriceNet ?? null
  );
  const [supplierName, setSupplierName] = useState(article.supplierName ?? "");
  const [occurredAt, setOccurredAt] = useState(todayInputValue());
  const [notes, setNotes] = useState("");
  const [updateArticlePrice, setUpdateArticlePrice] = useState(true);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const onHand =
    article.stockBalances?.find((b) => b.storageLocationId === locationId)?.onHandQuantity ?? 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!locationId || quantity == null || quantity <= 0) {
      setMsg("Bitte eine gültige Menge eingeben.");
      return;
    }
    setSaving(true);
    setMsg("");

    const payload = {
      articleId: article.id,
      storageLocationId: locationId,
      quantity,
      purchasePriceNet,
      supplierName: supplierName.trim() || undefined,
      notes: notes.trim() || undefined,
      occurredAt: new Date(`${occurredAt}T12:00:00`).toISOString(),
      updateArticlePrice,
    };

    let res: Response;
    if (receipt) {
      const form = new FormData();
      form.append("data", JSON.stringify(payload));
      form.append("receipt", receipt);
      res = await fetch("/api/stock/replenish", { method: "POST", body: form });
    } else {
      res = await fetch("/api/stock/replenish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    const data = await res.json();
    setSaving(false);
    if (data.success) {
      toast.success(data.data.message ?? "Bestand aufgefüllt");
      onSuccess();
      onClose();
    } else {
      setMsg(data.error ?? "Auffüllen fehlgeschlagen");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <PackagePlus className="h-5 w-5 text-[#0d5c63]" /> Bestand auffüllen
        </h3>
        <p className="text-sm text-slate-600">
          <span className="font-medium">{article.name}</span>
          <span className="text-slate-400"> · Einheit: {article.unit}</span>
        </p>

        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium">Lagerort</label>
            <select
              className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              required
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Aktuell: {onHand} {article.unit}
            </p>
          </div>

          <NumberInput
            label={`Menge (${article.unit})`}
            min={0}
            required
            value={quantity}
            onValueChange={setQuantity}
          />
          <div>
            <label className="text-sm font-medium">Datum</label>
            <input
              type="date"
              className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              required
            />
          </div>

          <NumberInput
            label="Einkaufspreis netto"
            suffix="€"
            min={0}
            value={purchasePriceNet}
            onValueChange={setPurchasePriceNet}
          />
          <Input
            label="Lieferant"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
          />

          <label className="sm:col-span-2 flex items-start gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="mt-1"
              checked={updateArticlePrice}
              onChange={(e) => setUpdateArticlePrice(e.target.checked)}
            />
            <span>Einkaufspreis am Artikel aktualisieren</span>
          </label>

          <div className="sm:col-span-2">
            <label className="text-sm font-medium">Beleg (optional)</label>
            <input
              type="file"
              accept="image/*,.pdf,application/pdf"
              className="w-full mt-1 text-sm"
              onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="sm:col-span-2">
            <Textarea
              label="Notiz (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {msg && <p className="sm:col-span-2 text-sm text-red-600">{msg}</p>}

          <div className="sm:col-span-2 flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Abbrechen
            </Button>
            <Button type="submit" variant="action" disabled={saving}>
              {saving ? "Wird gebucht…" : "Auffüllen bestätigen"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function StockReplenishDialog({
  article,
  locations,
  defaultLocationId,
  onClose,
  onSuccess,
}: StockReplenishDialogProps) {
  if (!article) return null;
  return (
    <StockReplenishDialogContent
      key={`${article.id}:${defaultLocationId ?? ""}`}
      article={article}
      locations={locations}
      defaultLocationId={defaultLocationId}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}
