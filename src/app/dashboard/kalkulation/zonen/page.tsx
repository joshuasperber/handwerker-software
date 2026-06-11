"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { formatEuro } from "@/lib/utils";
import { CanAccess } from "@/components/auth/can-access";

interface Zone {
  id: string;
  name: string;
  description: string | null;
  flatFeeNet: number;
  useFormula: boolean;
  isActive: boolean;
  minKm: number;
  maxKm: number | null;
}

const EMPTY = { name: "", description: "", flatFeeNet: null as number | null, useFormula: false };

export default function ZonenverwaltungPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<typeof EMPTY>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<typeof EMPTY>(EMPTY);

  function load() {
    fetch("/api/travel-zones")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setZones(d.data);
        setLoading(false);
      });
  }

  useEffect(() => {
    fetch("/api/travel-zones")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setZones(d.data);
        setLoading(false);
      });
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/travel-zones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: createForm.name,
        description: createForm.description || undefined,
        flatFeeNet: createForm.useFormula ? 0 : (createForm.flatFeeNet ?? 0),
        useFormula: createForm.useFormula,
      }),
    });
    const d = await res.json();
    if (!d.success) { setError(d.error ?? "Zone konnte nicht angelegt werden"); return; }
    setCreateForm(EMPTY);
    setCreating(false);
    load();
  }

  function startEdit(z: Zone) {
    setEditId(z.id);
    setError("");
    setEditForm({
      name: z.name,
      description: z.description ?? "",
      flatFeeNet: z.flatFeeNet,
      useFormula: z.useFormula,
    });
  }

  async function saveEdit(id: string) {
    setError("");
    const res = await fetch(`/api/travel-zones/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name,
        description: editForm.description || null,
        flatFeeNet: editForm.useFormula ? 0 : (editForm.flatFeeNet ?? 0),
        useFormula: editForm.useFormula,
      }),
    });
    const d = await res.json();
    if (!d.success) { setError(d.error ?? "Zone konnte nicht gespeichert werden"); return; }
    setEditId(null);
    load();
  }

  async function toggleActive(z: Zone) {
    await fetch(`/api/travel-zones/${z.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !z.isActive }),
    });
    load();
  }

  async function remove(z: Zone) {
    if (!confirm(`Zone "${z.name}" wirklich löschen?`)) return;
    const res = await fetch(`/api/travel-zones/${z.id}`, { method: "DELETE" });
    const d = await res.json();
    if (d.success && d.data?.message) alert(d.data.message);
    load();
  }

  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/kalkulation/einstellungen" className="text-sm text-[#0d5c63] flex items-center gap-1 mb-4 hover:underline">
        <ChevronLeft className="h-4 w-4" /> Zurück zu Einstellungen
      </Link>

      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">Anfahrtszonen</h1>
        <CanAccess permission="calculations.settings">
          <Button variant="action" size="sm" onClick={() => { setCreating((c) => !c); setError(""); }}>
            <Plus className="h-4 w-4 mr-1" /> Zone anlegen
          </Button>
        </CanAccess>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Jede Zone hat einen festen Anfahrtspreis (netto). Die Zone wird einem Kundenstandort zugeordnet und bestimmt die Anfahrtskosten in Angeboten und Rechnungen.
      </p>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {creating && (
        <Card title="Neue Zone" className="mb-6">
          <form onSubmit={create} className="space-y-3">
            <Input label="Name der Zone *" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required />
            <Textarea label="Beschreibung / Notiz (optional)" value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} rows={2} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={createForm.useFormula} onChange={(e) => setCreateForm({ ...createForm, useFormula: e.target.checked })} />
              Preis per Formel (km × Satz + Fahrzeit) statt Pauschale
            </label>
            {!createForm.useFormula && (
              <NumberInput label="Preis netto" suffix="€" required min={0} value={createForm.flatFeeNet} onValueChange={(v) => setCreateForm({ ...createForm, flatFeeNet: v })} />
            )}
            <div className="flex gap-2">
              <Button type="submit" variant="action" size="sm">Speichern</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => { setCreating(false); setCreateForm(EMPTY); }}>Abbrechen</Button>
            </div>
          </form>
        </Card>
      )}

      <Card title={`Zonen (${zones.length})`}>
        {loading ? (
          <p className="text-sm text-slate-500">Laden...</p>
        ) : zones.length === 0 ? (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
            Noch keine Zonen angelegt. Ohne Zone können keine Anfahrtskosten berechnet werden.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {zones.map((z) => (
              <div key={z.id} className="py-3">
                {editId === z.id ? (
                  <div className="space-y-3">
                    <Input label="Name *" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                    <Textarea label="Beschreibung / Notiz" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={2} />
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={editForm.useFormula} onChange={(e) => setEditForm({ ...editForm, useFormula: e.target.checked })} />
                      Preis per Formel statt Pauschale
                    </label>
                    {!editForm.useFormula && (
                      <NumberInput label="Preis netto" suffix="€" min={0} value={editForm.flatFeeNet} onValueChange={(v) => setEditForm({ ...editForm, flatFeeNet: v })} />
                    )}
                    <div className="flex gap-2">
                      <Button type="button" variant="action" size="sm" onClick={() => saveEdit(z.id)}>
                        <Check className="h-4 w-4 mr-1" /> Speichern
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setEditId(null)}>
                        <X className="h-4 w-4 mr-1" /> Abbrechen
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className={z.isActive ? "" : "opacity-50"}>
                      <p className="font-medium flex items-center gap-2">
                        {z.name}
                        {!z.isActive && <span className="text-xs rounded bg-slate-200 px-1.5 py-0.5 text-slate-600">inaktiv</span>}
                      </p>
                      <p className="text-sm text-slate-600">
                        {z.useFormula ? "Formel (km × Satz + Fahrzeit)" : formatEuro(z.flatFeeNet)}
                      </p>
                      {z.description && <p className="text-xs text-slate-400 mt-0.5">{z.description}</p>}
                    </div>
                    <CanAccess permission="calculations.settings">
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => toggleActive(z)}>
                          {z.isActive ? "Deaktivieren" : "Aktivieren"}
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => startEdit(z)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" className="text-red-600" onClick={() => remove(z)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CanAccess>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
