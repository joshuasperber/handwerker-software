"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatEuro } from "@/lib/utils";

type Addendum = {
  id: string;
  description: string;
  occurredOn: string;
  materialNote: string | null;
  extraHours: number | null;
  extraPriceNet: number | null;
  note: string | null;
  employeeName: string | null;
};

export function OrderAddendaCard({
  orderId,
  useFixedPrice,
  onChanged,
}: {
  orderId: string;
  useFixedPrice: boolean;
  onChanged?: () => void;
}) {
  const [items, setItems] = useState<Addendum[]>([]);
  const [description, setDescription] = useState("");
  const [materialNote, setMaterialNote] = useState("");
  const [extraHours, setExtraHours] = useState("");
  const [extraPrice, setExtraPrice] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [note, setNote] = useState("");
  const [apply, setApply] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/orders/${orderId}/addenda`);
    const data = await res.json();
    if (data.success && Array.isArray(data.data)) setItems(data.data);
  }, [orderId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initialer, asynchroner Nachtragsabruf.
    void load();
  }, [load]);

  async function save() {
    if (!description.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/orders/${orderId}/addenda`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: description.trim(),
        materialNote: materialNote.trim() || null,
        extraHours: extraHours ? Number(extraHours.replace(",", ".")) : null,
        extraPriceNet: extraPrice ? Number(extraPrice.replace(",", ".")) : null,
        employeeName: employeeName.trim() || null,
        note: note.trim() || null,
        applyToFixedPrice: apply,
      }),
    });
    setSaving(false);
    const data = await res.json();
    if (!data.success) return;
    setDescription("");
    setMaterialNote("");
    setExtraHours("");
    setExtraPrice("");
    setEmployeeName("");
    setNote("");
    setApply(false);
    await load();
    onChanged?.();
  }

  return (
    <Card title="Zusatzarbeiten / Nachträge" className="mb-6">
      <p className="mb-3 text-sm text-slate-600">
        Ergänzungen bleiben auf diesem Auftrag. Es wird kein neuer Auftrag angelegt.
        {useFixedPrice
          ? " Ein Zusatzpreis ändert den Festpreis nur, wenn du das ausdrücklich auswählst."
          : ""}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1 sm:col-span-2">
          <Label htmlFor="addendum-desc">Beschreibung</Label>
          <Input id="addendum-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="addendum-material">Material</Label>
          <Input id="addendum-material" value={materialNote} onChange={(e) => setMaterialNote(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="addendum-hours">Zusätzliche Arbeitszeit (Std.)</Label>
          <Input id="addendum-hours" inputMode="decimal" value={extraHours} onChange={(e) => setExtraHours(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="addendum-price">Zusätzlicher Preis netto (€)</Label>
          <Input id="addendum-price" inputMode="decimal" value={extraPrice} onChange={(e) => setExtraPrice(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="addendum-employee">Mitarbeiter</Label>
          <Input id="addendum-employee" value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} />
        </div>
        <div className="grid gap-1 sm:col-span-2">
          <Label htmlFor="addendum-note">Notiz</Label>
          <Textarea id="addendum-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      {useFixedPrice && (
        <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} />
          Festpreis um den zusätzlichen Preis erhöhen
        </label>
      )}
      <Button type="button" className="mt-3" disabled={saving || !description.trim()} onClick={() => void save()}>
        {saving ? "Speichern…" : "Nachtrag am Auftrag speichern"}
      </Button>
      {items.length > 0 && (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-slate-100 p-3 text-sm">
              <p className="font-medium text-slate-800">{item.description}</p>
              <p className="text-xs text-slate-500">
                {formatDate(item.occurredOn)}
                {item.employeeName ? ` · ${item.employeeName}` : ""}
                {item.extraHours != null ? ` · ${item.extraHours} Std.` : ""}
                {item.extraPriceNet != null ? ` · ${formatEuro(item.extraPriceNet)}` : ""}
              </p>
              {item.materialNote && <p className="text-xs text-slate-600">Material: {item.materialNote}</p>}
              {item.note && <p className="text-xs text-slate-600">{item.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
