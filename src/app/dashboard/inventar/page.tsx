"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Card } from "@/components/ui/card";
import { CanAccess } from "@/components/auth/can-access";
import { AddButton } from "@/components/ui/add-button";
import { saveJson } from "@/lib/save-toast";
import { Package, Plus, AlertTriangle, ArrowRightLeft, History, GripVertical } from "lucide-react";

interface ArticleRow {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  category: string | null;
  minimumStock: number;
  targetStock: number;
  purchasePriceNet: number | null;
  totals: {
    onHand: number;
    reserved: number;
    available: number;
    lowStock: boolean;
  };
}

interface StockSummary {
  items: {
    articleId: string;
    name: string;
    available: number;
    minimumStock: number;
    lowStock: boolean;
    reorderSuggestion: number;
  }[];
  warningCount: number;
}

interface MovementRow {
  id: string;
  movementType: string;
  quantity: number;
  notes: string | null;
  createdAt: string;
  article: { name: string; unit: string };
  storageLocation: { name: string; locationType: string };
}

const LOCATION_TYPES = [
  { value: "HAUPTLAGER", label: "Hauptlager" },
  { value: "FAHRZEUG", label: "Fahrzeug" },
  { value: "MITARBEITER", label: "Mitarbeiter" },
  { value: "BAUSTELLE", label: "Baustelle" },
  { value: "DEFEKTLAGER", label: "Defektlager" },
];

const MOVEMENT_LABELS: Record<string, string> = {
  ZUGANG: "Zugang",
  ABGANG: "Abgang",
  VERBRAUCH: "Verbrauch",
  RUECKGABE: "Rückgabe",
};
interface StorageLocation {
  id: string;
  name: string;
  locationType: string;
  articleCount: number;
  totalOnHand: number;
}

interface LocationStock {
  id: string;
  name: string;
  locationType: string;
  stock: {
    articleId: string;
    name: string;
    unit: string;
    onHand: number;
    reserved: number;
    available: number;
  }[];
  totalOnHand: number;
  totalReserved: number;
}

export default function InventarPage() {
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [locationDetail, setLocationDetail] = useState<LocationStock | null>(null);
  const [stockForm, setStockForm] = useState({ articleId: "", quantity: null as number | null });
  const [stockMsg, setStockMsg] = useState("");
  const [tab, setTab] = useState<"artikel" | "lagerorte" | "bewegungen">("artikel");
  const [showForm, setShowForm] = useState(false);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [locationForm, setLocationForm] = useState({ name: "", locationType: "BAUSTELLE", description: "" });
  const [locationMsg, setLocationMsg] = useState("");
  const [transferForm, setTransferForm] = useState({ articleId: "", fromLocationId: "", toLocationId: "", quantity: null as number | null });
  const [transferMsg, setTransferMsg] = useState("");
  const [dragItem, setDragItem] = useState<{
    articleId: string;
    name: string;
    unit: string;
    available: number;
    fromLocationId: string;
    fromName: string;
  } | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dndModal, setDndModal] = useState<{
    articleId: string;
    name: string;
    unit: string;
    available: number;
    fromLocationId: string;
    fromName: string;
    toLocationId: string;
    toName: string;
  } | null>(null);
  const [dndQty, setDndQty] = useState<number | null>(null);
  const [dndMsg, setDndMsg] = useState("");
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [form, setForm] = useState({
    name: "",
    unit: "Stk",
    packageSize: 1,
    category: "",
    minimumStock: 10,
    targetStock: 50,
    initialStock: 0,
    initialLocationId: "",
    purchasePriceNet: null as number | null,
  });
  const [loading, setLoading] = useState(true);

  function load() {
    Promise.all([
      fetch("/api/articles").then((r) => r.json()),
      fetch("/api/stock").then((r) => r.json()),
      fetch("/api/storage-locations").then((r) => r.json()),
    ]).then(([a, s, l]) => {
      if (a.success) setArticles(a.data);
      if (s.success) setSummary(s.data);
      if (l.success && l.data?.length) {
        setLocations(l.data);
        // Standard-Lagerort für das Formular vorbelegen (Hauptlager bevorzugt).
        setForm((f) => {
          if (f.initialLocationId) return f;
          const haupt = l.data.find(
            (loc: { locationType: string }) => loc.locationType === "HAUPTLAGER"
          );
          return { ...f, initialLocationId: haupt?.id ?? l.data[0].id };
        });
      } else if (l.success) {
        setLocations(l.data);
      }
      setLoading(false);
    });
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (tab !== "bewegungen") return;
    fetch("/api/stock/movements?limit=80")
      .then((r) => r.json())
      .then((d) => { if (d.success) setMovements(d.data); });
  }, [tab, stockMsg, transferMsg]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!selectedLocationId) {
        if (active) setLocationDetail(null);
        return;
      }
      const r = await fetch(`/api/storage-locations/${selectedLocationId}`);
      const d = await r.json();
      if (active && d.success) {
        setLocationDetail({
          id: d.data.id,
          name: d.data.name,
          locationType: d.data.locationType,
          stock: d.data.stock,
          totalOnHand: d.data.totalOnHand,
          totalReserved: d.data.totalReserved,
        });
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedLocationId]);

  async function assignStockToLocation(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLocationId || !stockForm.articleId || stockForm.quantity == null) return;
    setStockMsg("");
    const res = await fetch("/api/stock/movement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        articleId: stockForm.articleId,
        storageLocationId: selectedLocationId,
        movementType: "ZUGANG",
        quantity: stockForm.quantity ?? 0,
        notes: "Manuelle Zuordnung",
      }),
    });
    const data = await res.json();
    if (data.success) {
      setStockForm({ articleId: "", quantity: null });
      setStockMsg("Bestand aktualisiert");
      load();
      setSelectedLocationId(selectedLocationId);
    } else {
      setStockMsg(data.error ?? "Fehler");
    }
  }

  async function createLocation(e: React.FormEvent) {
    e.preventDefault();
    setLocationMsg("");
    const res = await fetch("/api/storage-locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(locationForm),
    });
    const data = await res.json();
    if (data.success) {
      setShowLocationForm(false);
      setLocationForm({ name: "", locationType: "BAUSTELLE", description: "" });
      setLocationMsg("");
      load();
      setSelectedLocationId(data.data.id);
      setTab("lagerorte");
    } else {
      setLocationMsg(data.error ?? "Fehler");
    }
  }

  async function transferStock(e: React.FormEvent) {
    e.preventDefault();
    setTransferMsg("");
    const res = await fetch("/api/stock/movement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transfer: true,
        articleId: transferForm.articleId,
        fromLocationId: transferForm.fromLocationId,
        toLocationId: transferForm.toLocationId,
        quantity: transferForm.quantity ?? 0,
      }),
    });
    const data = await res.json();
    if (data.success) {
      setTransferForm({ articleId: "", fromLocationId: "", toLocationId: "", quantity: null });
      setTransferMsg(`Verschoben: ${data.data.from} → ${data.data.to}`);
      load();
      if (selectedLocationId) setSelectedLocationId(selectedLocationId);
    } else {
      setTransferMsg(data.error ?? "Fehler");
    }
  }

  function handleDropOnLocation(toLocationId: string, toName: string) {
    if (!dragItem || dragItem.fromLocationId === toLocationId) {
      setDragItem(null);
      setDragOverId(null);
      return;
    }
    setDndModal({ ...dragItem, toLocationId, toName });
    setDndQty(dragItem.available);
    setDndMsg("");
    setDragItem(null);
    setDragOverId(null);
  }

  async function confirmDndTransfer() {
    if (!dndModal) return;
    const qty = dndQty ?? 0;
    if (!qty || qty <= 0) {
      setDndMsg("Bitte eine gültige Menge eingeben.");
      return;
    }
    if (qty > dndModal.available) {
      setDndMsg(`Maximal ${dndModal.available} ${dndModal.unit} verfügbar.`);
      return;
    }
    const res = await fetch("/api/stock/movement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transfer: true,
        articleId: dndModal.articleId,
        fromLocationId: dndModal.fromLocationId,
        toLocationId: dndModal.toLocationId,
        quantity: qty,
      }),
    });
    const data = await res.json();
    if (data.success) {
      const refreshId = selectedLocationId;
      setDndModal(null);
      load();
      if (refreshId) setSelectedLocationId(refreshId);
    } else {
      setDndMsg(data.error ?? "Fehler beim Umbuchen");
    }
  }

  async function createArticle(e: React.FormEvent) {
    e.preventDefault();
    const res = await saveJson("/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        purchasePriceNet: form.purchasePriceNet != null ? form.purchasePriceNet : undefined,
      }),
    });
    if (res.success) {
      setShowForm(false);
      setForm((f) => ({
        name: "",
        unit: "Stk",
        packageSize: 1,
        category: "",
        minimumStock: 10,
        targetStock: 50,
        initialStock: 0,
        initialLocationId: f.initialLocationId,
        purchasePriceNet: null as number | null,
      }));
      load();
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="h-7 w-7 text-[#0d5c63]" />
            Inventar & Lager
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Artikel, Bestände, Reservierungen und Lagerwarnungen</p>
        </div>
        <CanAccess permission="inventory.write">
          <AddButton onClick={() => setShowForm(!showForm)}>Artikel anlegen</AddButton>
        </CanAccess>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setTab("artikel")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "artikel" ? "bg-slate-200 text-slate-900" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          Artikel
        </button>
        <button
          type="button"
          onClick={() => setTab("lagerorte")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "lagerorte" ? "bg-slate-200 text-slate-900" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          Lagerorte
        </button>
        <button
          type="button"
          onClick={() => setTab("bewegungen")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "bewegungen" ? "bg-slate-200 text-slate-900" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          <History className="h-4 w-4 inline mr-1" /> Bewegungen
        </button>
        <Link href="/dashboard/einkauf" className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-[#0d5c63] hover:bg-slate-50 ml-auto">
          Einkauf & Bestellvorschläge →
        </Link>
      </div>

      {summary && summary.warningCount > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50 !p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900">{summary.warningCount} Lagerwarnung(en)</p>
              <ul className="text-sm text-amber-800 mt-1 space-y-0.5">
                {summary.items.filter((i) => i.lowStock).slice(0, 5).map((i) => (
                  <li key={i.articleId}>{i.name}: {i.available} verfügbar (Min. {i.minimumStock})</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <CanAccess permission="inventory.write">
      {showForm && (
        <Card title="Neuer Artikel" className="mb-6">
          <form onSubmit={createArticle} className="grid gap-3 sm:grid-cols-2">
            <Input label="Artikelname *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label="Kategorie" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <Input label="Einheit (z. B. Stk, m, kg, l)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            <NumberInput label={`Verpackungseinheit (${form.unit || "Stk"} pro Gebinde)`} min={1} value={form.packageSize} onValueChange={(v) => setForm({ ...form, packageSize: v ?? 1 })} />
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-sm font-medium text-foreground">Ziellager für Anfangsbestand</label>
              <select
                className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
                value={form.initialLocationId}
                onChange={(e) => setForm({ ...form, initialLocationId: e.target.value })}
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.locationType.replace(/_/g, " ")})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400">
                Der Anfangsbestand wird direkt in dieses Lager gebucht.
              </p>
            </div>
            <NumberInput label="Anfangsbestand" min={0} value={form.initialStock} onValueChange={(v) => setForm({ ...form, initialStock: v ?? 0 })} />
            <NumberInput label="Mindestbestand" min={0} value={form.minimumStock} onValueChange={(v) => setForm({ ...form, minimumStock: v ?? 0 })} />
            <NumberInput label="Zielbestand" min={0} value={form.targetStock} onValueChange={(v) => setForm({ ...form, targetStock: v ?? 0 })} />
            <NumberInput label="Einkaufspreis netto" suffix="€" value={form.purchasePriceNet} onValueChange={(v) => setForm({ ...form, purchasePriceNet: v })} />
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" variant="action">Speichern</Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Abbrechen</Button>
            </div>
          </form>
        </Card>
      )}
      </CanAccess>

      <Card>
        {tab === "bewegungen" ? (
          <div>
            <p className="text-sm text-slate-500 mb-4">Protokoll aller Lagerbewegungen inkl. Umbuchungen und Wareneingänge.</p>
            {movements.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">Keine Bewegungen.</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {movements.map((m) => (
                  <div key={m.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div>
                      <p className="font-medium text-sm">{m.article.name}</p>
                      <p className="text-xs text-slate-500">
                        {MOVEMENT_LABELS[m.movementType] ?? m.movementType} · {m.quantity} {m.article.unit} · {m.storageLocation.name}
                      </p>
                      {m.notes && <p className="text-xs text-slate-400 italic">{m.notes}</p>}
                    </div>
                    <p className="text-xs text-slate-400 shrink-0">{new Date(m.createdAt).toLocaleString("de-DE")}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : tab === "lagerorte" ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <CanAccess permission="inventory.write">
                <div className="mb-4">
                  <Button size="sm" variant="outline" onClick={() => setShowLocationForm(!showLocationForm)}>
                    <Plus className="h-4 w-4 mr-1" /> Neues Lager
                  </Button>
                </div>
                {showLocationForm && (
                  <form onSubmit={createLocation} className="rounded-xl border border-slate-200 p-4 mb-4 space-y-3 bg-slate-50">
                    <Input label="Name *" value={locationForm.name} onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })} required />
                    <div>
                      <label className="text-sm font-medium">Typ</label>
                      <select
                        className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
                        value={locationForm.locationType}
                        onChange={(e) => setLocationForm({ ...locationForm, locationType: e.target.value })}
                      >
                        {LOCATION_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <Input label="Beschreibung" value={locationForm.description} onChange={(e) => setLocationForm({ ...locationForm, description: e.target.value })} />
                    <Button type="submit" size="sm" variant="action">Lager anlegen</Button>
                    {locationMsg && <p className="text-sm text-red-600">{locationMsg}</p>}
                  </form>
                )}
              </CanAccess>
              {dragItem && (
                <p className="text-xs text-[#0d5c63] bg-[#0d5c63]/5 rounded-lg px-3 py-2 mb-2">
                  „{dragItem.name}“ auf ein Ziellager ziehen, um umzubuchen…
                </p>
              )}
              <div className="divide-y divide-slate-50">
              {locations.map((loc) => {
                const isDropTarget = Boolean(dragItem) && dragItem!.fromLocationId !== loc.id;
                return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => setSelectedLocationId(loc.id)}
                  onDragOver={(e) => {
                    if (!isDropTarget) return;
                    e.preventDefault();
                    setDragOverId(loc.id);
                  }}
                  onDragLeave={() => setDragOverId((id) => (id === loc.id ? null : id))}
                  onDrop={(e) => {
                    if (!isDropTarget) return;
                    e.preventDefault();
                    handleDropOnLocation(loc.id, loc.name);
                  }}
                  className={`w-full py-4 flex justify-between items-center text-left px-2 rounded-lg transition-colors ${
                    dragOverId === loc.id
                      ? "ring-2 ring-[#0d5c63] bg-[#0d5c63]/5"
                      : selectedLocationId === loc.id
                      ? "bg-slate-200"
                      : isDropTarget
                      ? "border border-dashed border-[#0d5c63]/40 hover:bg-[#0d5c63]/5"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div>
                    <p className="font-medium">{loc.name}</p>
                    <p className="text-sm text-slate-500">{loc.locationType.replace(/_/g, " ")} · {loc.articleCount} Artikel</p>
                  </div>
                  <span className="text-sm font-semibold text-[#0d5c63]">{loc.totalOnHand} Stk</span>
                </button>
                );
              })}
              {!locations.length && <p className="text-sm text-slate-500 py-8 text-center">Keine Lagerorte.</p>}
              </div>
            </div>

            {locationDetail ? (
              <div>
                <h3 className="font-semibold text-lg mb-1">{locationDetail.name}</h3>
                <p className="text-sm text-slate-500 mb-4">
                  {locationDetail.locationType.replace(/_/g, " ")} · {locationDetail.totalOnHand} Stk · {locationDetail.totalReserved} reserviert
                </p>
                {locationDetail.stock.length === 0 ? (
                  <p className="text-sm text-slate-500 mb-4">Noch kein Bestand an diesem Ort.</p>
                ) : (
                  <>
                    <p className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                      Tipp: Zeile auf ein anderes Lager links ziehen, um schnell umzubuchen.
                    </p>
                    <table className="w-full text-sm mb-4">
                      <thead>
                        <tr className="text-left text-slate-500 border-b">
                          <th className="pb-2 pl-3 pr-4">Artikel</th>
                          <th className="pb-2 pr-4 text-right">Bestand</th>
                          <th className="pb-2 pr-4 text-right">Reserviert</th>
                          <th className="pb-2 pr-3 text-right">Verfügbar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {locationDetail.stock.map((s) => {
                          const canDrag = s.available > 0;
                          return (
                            <tr
                              key={s.articleId}
                              draggable={canDrag}
                              onDragStart={(e) => {
                                if (!canDrag) return;
                                e.dataTransfer.effectAllowed = "move";
                                setDragItem({
                                  articleId: s.articleId,
                                  name: s.name,
                                  unit: s.unit,
                                  available: s.available,
                                  fromLocationId: locationDetail.id,
                                  fromName: locationDetail.name,
                                });
                              }}
                              onDragEnd={() => {
                                setDragItem(null);
                                setDragOverId(null);
                              }}
                              className={
                                canDrag
                                  ? "cursor-grab active:cursor-grabbing hover:bg-slate-50"
                                  : ""
                              }
                            >
                              <td className="py-2 pl-3 pr-4 font-medium">
                                <span className="inline-flex items-center gap-1.5">
                                  {canDrag && (
                                    <GripVertical className="h-3.5 w-3.5 text-slate-300" />
                                  )}
                                  {s.name}
                                </span>
                              </td>
                              <td className="py-2 pr-4 text-right">{s.onHand} {s.unit}</td>
                              <td className="py-2 pr-4 text-right text-amber-700">{s.reserved}</td>
                              <td className="py-2 pr-3 text-right font-semibold text-[#0d5c63]">{s.available}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </>
                )}
                <CanAccess permission="inventory.write">
                  <form onSubmit={assignStockToLocation} className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50">
                    <p className="text-sm font-medium">Menge zuordnen (Zugang)</p>
                    <select
                      className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
                      value={stockForm.articleId}
                      onChange={(e) => setStockForm({ ...stockForm, articleId: e.target.value })}
                      required
                    >
                      <option value="">Artikel wählen</option>
                      {articles.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                    <NumberInput
                      placeholder="Menge"
                      required
                      min={0}
                      value={stockForm.quantity}
                      onValueChange={(v) => setStockForm({ ...stockForm, quantity: v })}
                    />
                    <Button type="submit" size="sm" variant="action">Bestand buchen</Button>
                    {stockMsg && <p className="text-sm text-green-700">{stockMsg}</p>}
                  </form>
                  <form onSubmit={transferStock} className="rounded-xl border border-slate-200 p-4 space-y-3 mt-4">
                    <p className="text-sm font-medium flex items-center gap-1">
                      <ArrowRightLeft className="h-4 w-4" /> Umbuchung zwischen Lagern
                    </p>
                    <select
                      className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
                      value={transferForm.articleId}
                      onChange={(e) => setTransferForm({ ...transferForm, articleId: e.target.value })}
                      required
                    >
                      <option value="">Artikel wählen</option>
                      {articles.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                    <select
                      className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
                      value={transferForm.fromLocationId}
                      onChange={(e) => setTransferForm({ ...transferForm, fromLocationId: e.target.value })}
                      required
                    >
                      <option value="">Von Lager…</option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                    <select
                      className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
                      value={transferForm.toLocationId}
                      onChange={(e) => setTransferForm({ ...transferForm, toLocationId: e.target.value })}
                      required
                    >
                      <option value="">Nach Lager…</option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                    <NumberInput
                      placeholder="Menge"
                      required
                      min={0}
                      value={transferForm.quantity}
                      onValueChange={(v) => setTransferForm({ ...transferForm, quantity: v })}
                    />
                    <Button type="submit" size="sm" variant="outline">Verschieben</Button>
                    {transferMsg && <p className="text-sm text-green-700">{transferMsg}</p>}
                  </form>
                </CanAccess>
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-8 text-center lg:text-left">Lagerort auswählen, um Bestände zu sehen.</p>
            )}
          </div>
        ) : loading ? (
          <p className="text-slate-500 py-8 text-center">Laden...</p>
        ) : articles.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-slate-500 mb-4">Noch keine Artikel im Inventar.</p>
            <CanAccess permission="inventory.write">
              <Button onClick={() => setShowForm(true)}>Ersten Artikel anlegen</Button>
            </CanAccess>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="pb-3 pl-3 pr-4 font-medium">Artikel</th>
                    <th className="pb-3 pr-4 font-medium">Kategorie</th>
                    <th className="pb-3 pr-4 font-medium text-right">Bestand</th>
                    <th className="pb-3 pr-4 font-medium text-right">Reserviert</th>
                    <th className="pb-3 pr-4 font-medium text-right">Verfügbar</th>
                    <th className="pb-3 pr-4 font-medium text-right">Min.</th>
                    <th className="pb-3 pr-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {articles.map((a) => (
                    <tr key={a.id} className={a.totals.lowStock ? "bg-red-50/50" : ""}>
                      <td className="py-3 pl-3 pr-4 font-medium">{a.name}</td>
                      <td className="py-3 pr-4 text-slate-500">{a.category ?? "—"}</td>
                      <td className="py-3 pr-4 text-right">{a.totals.onHand} {a.unit}</td>
                      <td className="py-3 pr-4 text-right">{a.totals.reserved}</td>
                      <td className="py-3 pr-4 text-right font-semibold">{a.totals.available}</td>
                      <td className="py-3 pr-4 text-right text-slate-400">{a.minimumStock}</td>
                      <td className="py-3 pr-3">
                        {a.totals.lowStock ? (
                          <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Unter Mindestbestand</span>
                        ) : (
                          <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden space-y-3">
              {articles.map((a) => (
                <div key={a.id} className={`rounded-xl border p-4 ${a.totals.lowStock ? "border-red-200 bg-red-50/30" : "border-slate-200"}`}>
                  <p className="font-semibold">{a.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{a.category ?? "Allgemein"}</p>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center text-sm">
                    <div><p className="text-xs text-slate-400">Bestand</p><p className="font-medium">{a.totals.onHand}</p></div>
                    <div><p className="text-xs text-slate-400">Reserviert</p><p className="font-medium">{a.totals.reserved}</p></div>
                    <div><p className="text-xs text-slate-400">Verfügbar</p><p className="font-semibold text-[#0d5c63]">{a.totals.available}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <p className="text-xs text-slate-400 mt-4">
        Formel: Verfügbar = Bestand − reserviert · Bestellt (im Zulauf) wird separat geführt.
        {summary?.items.some((i) => i.reorderSuggestion > 0) && " Bestellvorschläge basieren auf Zielbestand und Verpackungseinheit."}
      </p>

      {dndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-[#0d5c63]" /> Bestand umbuchen
            </h3>
            <p className="text-sm text-slate-600">
              <span className="font-medium">{dndModal.name}</span> von{" "}
              <span className="font-medium">{dndModal.fromName}</span> nach{" "}
              <span className="font-medium">{dndModal.toName}</span> verschieben.
            </p>
            <NumberInput
              label={`Menge (max. ${dndModal.available} ${dndModal.unit})`}
              min={0}
              max={dndModal.available}
              value={dndQty}
              onValueChange={setDndQty}
              autoFocus
            />
            {dndMsg && <p className="text-sm text-red-600">{dndMsg}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDndModal(null)}>Abbrechen</Button>
              <Button variant="action" onClick={confirmDndTransfer}>Umbuchen</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
