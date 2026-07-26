"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Package } from "lucide-react";

export type StockAdjustMovementType = "ZUGANG" | "ABGANG" | "KORREKTUR";

interface StorageLocationOption {
  id: string;
  name: string;
  locationType: string;
}

interface StockBalanceOption {
  storageLocationId: string;
  onHandQuantity: number;
}

export interface StockAdjustArticle {
  id: string;
  name: string;
  unit: string;
  stockBalances?: StockBalanceOption[];
}

const MOVEMENT_OPTIONS: { value: StockAdjustMovementType; label: string; hint: string }[] = [
  { value: "ZUGANG", label: "Zugang", hint: "Menge zum Bestand hinzufügen" },
  { value: "ABGANG", label: "Abgang", hint: "Menge vom Bestand abziehen" },
  { value: "KORREKTUR", label: "Ist-Bestand setzen", hint: "Physischen Bestand nach Inventur eintragen" },
];

interface StockAdjustDialogProps {
  article: StockAdjustArticle | null;
  locations: StorageLocationOption[];
  defaultLocationId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

function StockAdjustDialogContent({
  article,
  locations,
  defaultLocationId,
  onClose,
  onSuccess,
}: {
  article: StockAdjustArticle;
  locations: StorageLocationOption[];
  defaultLocationId?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const haupt = locations.find((l) => l.locationType === "HAUPTLAGER");
  const [locationId, setLocationId] = useState(
    defaultLocationId ?? haupt?.id ?? locations[0]?.id ?? ""
  );
  const [movementType, setMovementType] = useState<StockAdjustMovementType>("ZUGANG");
  const [quantity, setQuantity] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const currentOnHand =
    article.stockBalances?.find((b) => b.storageLocationId === locationId)?.onHandQuantity ?? 0;

  const movementHint = MOVEMENT_OPTIONS.find((o) => o.value === movementType)?.hint ?? "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!locationId || quantity == null) return;
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/stock/movement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        articleId: article.id,
        storageLocationId: locationId,
        movementType,
        quantity,
        notes: notes.trim() || undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) {
      onSuccess();
      onClose();
    } else {
      setMsg(data.error ?? "Fehler bei der Buchung");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Package className="h-5 w-5 text-[#0d5c63]" /> Bestand anpassen
        </h3>
        <p className="text-sm text-slate-600">
          <span className="font-medium">{article.name}</span>
        </p>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-sm font-medium">Lagerort</label>
            <select
              className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              required
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.locationType.replace(/_/g, " ")})
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Aktuell an diesem Ort: {currentOnHand} {article.unit}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Buchungsart</label>
            <select
              className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
              value={movementType}
              onChange={(e) => setMovementType(e.target.value as StockAdjustMovementType)}
            >
              {MOVEMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">{movementHint}</p>
          </div>

          <NumberInput
            label={
              movementType === "KORREKTUR"
                ? `Neuer Ist-Bestand (${article.unit})`
                : `Menge (${article.unit})`
            }
            min={0}
            required
            value={quantity}
            onValueChange={setQuantity}
            autoFocus
          />

          <Input
            label="Notiz (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="z. B. Inventur, Nachlieferung, Schwund"
          />

          {msg && <p className="text-sm text-red-600">{msg}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Abbrechen
            </Button>
            <Button type="submit" variant="action" disabled={saving}>
              {saving ? "Wird gebucht…" : "Buchen"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function StockAdjustDialog({
  article,
  locations,
  defaultLocationId,
  onClose,
  onSuccess,
}: StockAdjustDialogProps) {
  if (!article) return null;

  return (
    <StockAdjustDialogContent
      key={`${article.id}:${defaultLocationId ?? ""}`}
      article={article}
      locations={locations}
      defaultLocationId={defaultLocationId}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}
