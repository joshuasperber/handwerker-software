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
import { Package, Plus, AlertTriangle, ArrowRightLeft, History, GripVertical, Pencil, PackageMinus, PackagePlus } from "lucide-react";
import { StockAdjustDialog, type StockAdjustArticle } from "@/components/inventory/stock-adjust-dialog";
import { ArticleEditDialog, type EditableArticle } from "@/components/inventory/article-edit-dialog";
import { StockWithdrawDialog, type WithdrawArticle } from "@/components/inventory/stock-withdraw-dialog";
import { StockReplenishDialog, type ReplenishArticle } from "@/components/inventory/stock-replenish-dialog";
import { ArticleHistoryDialog } from "@/components/inventory/article-history-dialog";
import {
  ARTICLE_UNITS,
  CUSTOM_UNIT_VALUE,
  normalizeUnitLabel,
} from "@/lib/inventory/units";
import { formatEuro } from "@/lib/utils";
import {
  MOVEMENT_TYPE_LABELS,
  REASON_LABELS,
} from "@/lib/inventory/reasons";
import { swrKeys, useApiSWR } from "@/lib/swr";

interface ArticleRow {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  category: string | null;
  description: string | null;
  packageSize: number;
  minimumStock: number;
  targetStock: number;
  purchasePriceNet: number | null;
  salesPriceNet: number | null;
  supplierName: string | null;
  stockBalances?: { storageLocationId: string; onHandQuantity: number }[];
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
  reason: string | null;
  quantity: number;
  purchasePriceNet: number | null;
  salePriceNet: number | null;
  notes: string | null;
  occurredAt: string;
  createdAt: string;
  documentedTotalMargin: number | null;
  article: { name: string; unit: string };
  storageLocation: { name: string; locationType: string };
  order: { orderNumber: string } | null;
  customer: { firstName: string; lastName: string } | null;
  employee: { user: { firstName: string; lastName: string } } | null;
  createdBy: { firstName: string; lastName: string } | null;
}

const LOCATION_TYPES = [
  { value: "HAUPTLAGER", label: "Hauptlager" },
  { value: "FAHRZEUG", label: "Fahrzeug" },
  { value: "MITARBEITER", label: "Mitarbeiter" },
  { value: "BAUSTELLE", label: "Baustelle" },
  { value: "DEFEKTLAGER", label: "Defektlager" },
];

const MOVEMENT_LABELS = MOVEMENT_TYPE_LABELS;
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
  const {
    data: articlesData,
    error: articlesError,
    isLoading: articlesLoading,
    mutate: mutateArticles,
  } = useApiSWR<ArticleRow[]>(swrKeys.articles());
  const { data: summary, mutate: mutateStock } = useApiSWR<StockSummary>(
    swrKeys.stock()
  );
  const {
    data: locationsData,
    error: locationsError,
    mutate: mutateLocations,
  } = useApiSWR<StorageLocation[]>(swrKeys.storageLocations());

  const articles = articlesData ?? [];
  const locations = locationsData ?? [];
  const loading = articlesLoading && !articlesData;
  const loadError = articlesError
    ? "Artikel konnten nicht geladen werden."
    : locationsError
      ? "Lagerorte konnten nicht geladen werden."
      : "";

  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [locationDetail, setLocationDetail] = useState<LocationStock | null>(null);
  const [stockForm, setStockForm] = useState({
    articleId: "",
    quantity: null as number | null,
    movementType: "ZUGANG" as "ZUGANG" | "ABGANG" | "KORREKTUR",
    notes: "",
  });
  const [stockMsg, setStockMsg] = useState("");
  const [adjustArticle, setAdjustArticle] = useState<StockAdjustArticle | null>(null);
  const [editArticle, setEditArticle] = useState<EditableArticle | null>(null);
  const [withdrawArticle, setWithdrawArticle] = useState<WithdrawArticle | null>(null);
  const [replenishArticle, setReplenishArticle] = useState<ReplenishArticle | null>(null);
  const [historyArticle, setHistoryArticle] = useState<{ id: string; name: string } | null>(null);
  const [locationRefreshKey, setLocationRefreshKey] = useState(0);
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
  const [form, setForm] = useState({
    name: "",
    unit: "Stück",
    customUnit: "",
    packageSize: 1,
    category: "",
    description: "",
    minimumStock: 10,
    targetStock: 50,
    initialStock: 0,
    initialLocationId: "",
    purchasePriceNet: null as number | null,
    salesPriceNet: null as number | null,
  });
  const [unitMode, setUnitMode] = useState<"preset" | "custom">("preset");

  const movementsKey =
    tab === "bewegungen" ? swrKeys.stockMovements(80) : null;
  const { data: movementsData, mutate: mutateMovements } =
    useApiSWR<MovementRow[]>(movementsKey);
  const movements = movementsData ?? [];

  const locationDetailKey = selectedLocationId
    ? swrKeys.storageLocation(selectedLocationId)
    : null;
  const { data: locationDetailRaw, mutate: mutateLocationDetail } =
    useApiSWR<{
      id: string;
      name: string;
      locationType: string;
      stock: LocationStock["stock"];
      totalOnHand: number;
      totalReserved: number;
    }>(locationDetailKey);

  useEffect(() => {
    if (!locationDetailRaw) {
      setLocationDetail(null);
      return;
    }
    setLocationDetail({
      id: locationDetailRaw.id,
      name: locationDetailRaw.name,
      locationType: locationDetailRaw.locationType,
      stock: locationDetailRaw.stock,
      totalOnHand: locationDetailRaw.totalOnHand,
      totalReserved: locationDetailRaw.totalReserved,
    });
  }, [locationDetailRaw, locationRefreshKey]);

  useEffect(() => {
    if (!locations.length) return;
    setForm((f) => {
      if (f.initialLocationId) return f;
      const haupt = locations.find((loc) => loc.locationType === "HAUPTLAGER");
      return { ...f, initialLocationId: haupt?.id ?? locations[0].id };
    });
  }, [locations]);

  function resolvedUnit() {
    return unitMode === "custom"
      ? form.customUnit.trim() || "sonstige Einheit"
      : form.unit;
  }

  function refreshLocationDetail(locationId: string) {
    if (selectedLocationId === locationId) {
      void mutateLocationDetail();
    }
  }

  function afterStockChange() {
    void mutateArticles();
    void mutateStock();
    void mutateLocations();
    void mutateMovements();
    setLocationRefreshKey((k) => k + 1);
    if (selectedLocationId) {
      refreshLocationDetail(selectedLocationId);
    }
  }

  function load() {
    afterStockChange();
  }

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
        movementType: stockForm.movementType,
        quantity: stockForm.quantity ?? 0,
        notes: stockForm.notes.trim() || "Manuelle Buchung",
      }),
    });
    const data = await res.json();
    if (data.success) {
      setStockForm({ articleId: "", quantity: null, movementType: "ZUGANG", notes: "" });
      setStockMsg("Bestand aktualisiert");
      afterStockChange();
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
      afterStockChange();
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
      setDndModal(null);
      afterStockChange();
    } else {
      setDndMsg(data.error ?? "Fehler beim Umbuchen");
    }
  }

  async function createArticle(e: React.FormEvent) {
    e.preventDefault();
    const unit = resolvedUnit();
    const res = await saveJson("/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        unit,
        packageSize: form.packageSize,
        category: form.category || undefined,
        description: form.description || undefined,
        minimumStock: form.minimumStock,
        targetStock: form.targetStock,
        initialStock: form.initialStock,
        initialLocationId: form.initialLocationId,
        purchasePriceNet: form.purchasePriceNet != null ? form.purchasePriceNet : undefined,
        salesPriceNet: form.salesPriceNet != null ? form.salesPriceNet : undefined,
      }),
    });
    if (res.success) {
      setShowForm(false);
      setUnitMode("preset");
      setForm((f) => ({
        name: "",
        unit: "Stück",
        customUnit: "",
        packageSize: 1,
        category: "",
        description: "",
        minimumStock: 10,
        targetStock: 50,
        initialStock: 0,
        initialLocationId: f.initialLocationId,
        purchasePriceNet: null as number | null,
        salesPriceNet: null as number | null,
      }));
      load();
    }
  }

  function displayPrice(a: ArticleRow) {
    if (a.salesPriceNet != null) return a.salesPriceNet;
    if (a.purchasePriceNet != null) return a.purchasePriceNet;
    return null;
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

      <div className="flex flex-wrap gap-2 mb-6">
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
        <Link
          href="/dashboard/einkauf"
          className="inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2 rounded-xl text-sm font-medium bg-white border border-slate-200 text-[#0d5c63] hover:bg-slate-50 active:scale-[0.98] transition-[transform,background-color] touch-manipulation ml-auto w-full sm:w-auto"
        >
          Einkauf & Bestellvorschläge
        </Link>
      </div>

      {loadError && (
        <Card className="mb-6 !border-red-200 !bg-red-50 !p-4">
          <p className="text-sm text-red-700">{loadError}</p>
        </Card>
      )}

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
            <div>
              <label className="text-sm font-medium text-foreground">Einheit</label>
              <select
                className="w-full mt-1.5 h-10 rounded-lg border border-slate-300 px-3 text-sm"
                value={unitMode === "custom" ? CUSTOM_UNIT_VALUE : form.unit}
                onChange={(e) => {
                  if (e.target.value === CUSTOM_UNIT_VALUE) {
                    setUnitMode("custom");
                  } else {
                    setUnitMode("preset");
                    setForm({ ...form, unit: e.target.value });
                  }
                }}
              >
                {ARTICLE_UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
                <option value={CUSTOM_UNIT_VALUE}>sonstige Einheit…</option>
              </select>
              {unitMode === "custom" && (
                <Input
                  className="mt-2"
                  label="Eigene Einheit"
                  value={form.customUnit}
                  onChange={(e) => setForm({ ...form, customUnit: e.target.value })}
                  placeholder="z. B. Rolle, Beutel"
                />
              )}
            </div>
            <NumberInput
              label={`Verpackungsgröße (${resolvedUnit()} pro Gebinde)`}
              min={0.001}
              value={form.packageSize}
              onValueChange={(v) => setForm({ ...form, packageSize: v ?? 1 })}
            />
            <NumberInput label="Einkaufspreis netto" suffix="€" value={form.purchasePriceNet} onValueChange={(v) => setForm({ ...form, purchasePriceNet: v })} />
            <NumberInput label="Kalkulationspreis netto" suffix="€" value={form.salesPriceNet} onValueChange={(v) => setForm({ ...form, salesPriceNet: v })} />
            <p className="sm:col-span-2 text-xs text-slate-400 -mt-1">
              Kalkulationspreis wird in Angebot/Kalkulation übernommen; sonst der Einkaufspreis. Beide Felder sind optional, aber empfohlen.
            </p>
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
            <NumberInput label="Mindestbestand (optional)" min={0} value={form.minimumStock} onValueChange={(v) => setForm({ ...form, minimumStock: v ?? 0 })} />
            <NumberInput label="Zielbestand" min={0} value={form.targetStock} onValueChange={(v) => setForm({ ...form, targetStock: v ?? 0 })} />
            <div className="sm:col-span-2">
              <Input
                label="Beschreibung (optional)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="z. B. 50 g Schatulle, weiß"
              />
            </div>
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
            <p className="text-sm text-slate-500 mb-4">
              Protokoll aller Zugänge, Entnahmen, Verkäufe und Korrekturen.
            </p>
            {movements.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">Keine Bewegungen.</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {movements.map((m) => {
                  const isIn = m.movementType === "ZUGANG" || m.movementType === "RUECKGABE";
                  const reasonLabel = m.reason
                    ? REASON_LABELS[m.reason] ?? m.reason
                    : MOVEMENT_LABELS[m.movementType] ?? m.movementType;
                  const who = m.employee
                    ? `${m.employee.user.firstName} ${m.employee.user.lastName}`
                    : m.createdBy
                      ? `${m.createdBy.firstName} ${m.createdBy.lastName}`
                      : null;
                  return (
                    <div key={m.id} className="py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                      <div>
                        <p className="font-medium text-sm">{m.article.name}</p>
                        <p className="text-xs text-slate-500">
                          <span className={isIn ? "text-green-700 font-medium" : "text-red-700 font-medium"}>
                            {isIn ? "+" : "−"}{m.quantity} {m.article.unit}
                          </span>
                          {" · "}
                          {reasonLabel}
                          {" · "}
                          {m.storageLocation.name}
                          {who ? ` · ${who}` : ""}
                        </p>
                        <div className="flex flex-wrap gap-x-2 text-xs text-slate-400 mt-0.5">
                          {m.purchasePriceNet != null && <span>EK {formatEuro(m.purchasePriceNet)}</span>}
                          {m.salePriceNet != null && <span>VK {formatEuro(m.salePriceNet)}</span>}
                          {m.documentedTotalMargin != null && (
                            <span>Diff. {formatEuro(m.documentedTotalMargin)}</span>
                          )}
                          {m.order && <span>Auftrag {m.order.orderNumber}</span>}
                          {m.customer && (
                            <span>
                              {m.customer.firstName} {m.customer.lastName}
                            </span>
                          )}
                        </div>
                        {m.notes && <p className="text-xs text-slate-400 italic">{m.notes}</p>}
                      </div>
                      <p className="text-xs text-slate-400 shrink-0">
                        {new Date(m.occurredAt ?? m.createdAt).toLocaleString("de-DE")}
                      </p>
                    </div>
                  );
                })}
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
                    <div className="overflow-x-auto mb-4">
                    <table className="w-full min-w-[480px] text-sm">
                      <thead>
                        <tr className="text-left text-slate-500 border-b">
                          <th className="pb-2 pl-3 pr-4">Artikel</th>
                          <th className="pb-2 pr-4 text-right">Bestand</th>
                          <th className="pb-2 pr-4 text-right">Reserviert</th>
                          <th className="pb-2 pr-4 text-right">Verfügbar</th>
                          <th className="pb-2 pr-3 text-right">Aktion</th>
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
                              <td className="py-2 pr-4 text-right font-semibold text-[#0d5c63]">{s.available}</td>
                              <td className="py-2 pr-3 text-right">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2"
                                  onClick={() => {
                                    const full = articles.find((a) => a.id === s.articleId);
                                    setAdjustArticle(
                                      full ?? {
                                        id: s.articleId,
                                        name: s.name,
                                        unit: s.unit,
                                        stockBalances: [
                                          {
                                            storageLocationId: locationDetail.id,
                                            onHandQuantity: s.onHand,
                                          },
                                        ],
                                      }
                                    );
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                  </>
                )}
                <CanAccess permission="inventory.write">
                  <form onSubmit={assignStockToLocation} className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50">
                    <p className="text-sm font-medium">Bestand manuell buchen</p>
                    <select
                      className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
                      value={stockForm.movementType}
                      onChange={(e) =>
                        setStockForm({
                          ...stockForm,
                          movementType: e.target.value as "ZUGANG" | "ABGANG" | "KORREKTUR",
                        })
                      }
                    >
                      <option value="ZUGANG">Zugang (+)</option>
                      <option value="ABGANG">Abgang (−)</option>
                      <option value="KORREKTUR">Ist-Bestand setzen</option>
                    </select>
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
                      placeholder={
                        stockForm.movementType === "KORREKTUR" ? "Neuer Ist-Bestand" : "Menge"
                      }
                      required
                      min={0}
                      value={stockForm.quantity}
                      onValueChange={(v) => setStockForm({ ...stockForm, quantity: v })}
                    />
                    <Input
                      label="Notiz (optional)"
                      value={stockForm.notes}
                      onChange={(e) => setStockForm({ ...stockForm, notes: e.target.value })}
                    />
                    <Button type="submit" size="sm" variant="action">Bestand buchen</Button>
                    {stockMsg && (
                      <p className={`text-sm ${stockMsg.includes("Fehler") ? "text-red-600" : "text-green-700"}`}>
                        {stockMsg}
                      </p>
                    )}
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
                    <th className="pb-3 pr-4 font-medium">Einheit</th>
                    <th className="pb-3 pr-4 font-medium text-right">Preis</th>
                    <th className="pb-3 pr-4 font-medium text-right">Bestand</th>
                    <th className="pb-3 pr-4 font-medium text-right">Verfügbar</th>
                    <th className="pb-3 pr-4 font-medium text-right">Min.</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 pr-3 font-medium text-right">Aktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {articles.map((a) => {
                    const price = displayPrice(a);
                    return (
                    <tr key={a.id} className={a.totals.lowStock ? "bg-red-50/50" : ""}>
                      <td className="py-3 pl-3 pr-4">
                        <p className="font-medium">{a.name}</p>
                        <p className="text-xs text-slate-400">{a.category ?? "—"}{a.packageSize !== 1 ? ` · VPE ${a.packageSize}` : ""}</p>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{normalizeUnitLabel(a.unit)}</td>
                      <td className="py-3 pr-4 text-right font-medium">
                        {price != null ? formatEuro(price) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-3 pr-4 text-right">{a.totals.onHand}</td>
                      <td className="py-3 pr-4 text-right font-semibold">{a.totals.available}</td>
                      <td className="py-3 pr-4 text-right text-slate-400">{a.minimumStock}</td>
                      <td className="py-3 pr-4">
                        {a.totals.lowStock ? (
                          <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Unter Mindestbestand</span>
                        ) : (
                          <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">OK</span>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-right">
                        <CanAccess permission="inventory.write">
                          <div className="inline-flex flex-wrap justify-end gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="action"
                              onClick={() => setWithdrawArticle(a)}
                            >
                              <PackageMinus className="h-3.5 w-3.5 mr-1" /> Entnahme
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setReplenishArticle(a)}
                            >
                              <PackagePlus className="h-3.5 w-3.5 mr-1" /> Auffüllen
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setHistoryArticle({ id: a.id, name: a.name })}
                              title="Historie"
                            >
                              <History className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditArticle(a)}
                              title="Bearbeiten"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setAdjustArticle(a)}
                              title="Bestand anpassen"
                            >
                              Bestand
                            </Button>
                          </div>
                        </CanAccess>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="md:hidden space-y-3">
              {articles.map((a) => {
                const price = displayPrice(a);
                return (
                <div key={a.id} className={`rounded-xl border p-4 ${a.totals.lowStock ? "border-red-200 bg-red-50/30" : "border-slate-200"}`}>
                  <p className="font-semibold">{a.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {a.category ?? "Allgemein"} · {normalizeUnitLabel(a.unit)}
                    {price != null ? ` · ${formatEuro(price)}` : ""}
                  </p>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center text-sm">
                    <div><p className="text-xs text-slate-400">Bestand</p><p className="font-medium">{a.totals.onHand}</p></div>
                    <div><p className="text-xs text-slate-400">Reserviert</p><p className="font-medium">{a.totals.reserved}</p></div>
                    <div><p className="text-xs text-slate-400">Verfügbar</p><p className="font-semibold text-[#0d5c63]">{a.totals.available}</p></div>
                  </div>
                  <CanAccess permission="inventory.write">
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="action"
                        onClick={() => setWithdrawArticle(a)}
                      >
                        <PackageMinus className="h-3.5 w-3.5 mr-1" /> Entnahme
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setReplenishArticle(a)}
                      >
                        <PackagePlus className="h-3.5 w-3.5 mr-1" /> Auffüllen
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setHistoryArticle({ id: a.id, name: a.name })}
                      >
                        <History className="h-3.5 w-3.5 mr-1" /> Historie
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditArticle(a)}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Bearbeiten
                      </Button>
                    </div>
                  </CanAccess>
                </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      <p className="text-xs text-slate-400 mt-4">
        Formel: Verfügbar = Bestand − reserviert · Bestellt (im Zulauf) wird separat geführt.
        Preise in der Kalkulation ändern den Lagerbestand nicht — Entnahme nur über bewusste Buchung (Verbrauch/Abgang).
        {summary?.items.some((i) => i.reorderSuggestion > 0) && " Bestellvorschläge basieren auf Zielbestand und Verpackungseinheit."}
      </p>

      <ArticleEditDialog
        article={editArticle}
        onClose={() => setEditArticle(null)}
        onSuccess={afterStockChange}
      />

      <StockWithdrawDialog
        article={withdrawArticle}
        locations={locations}
        defaultLocationId={selectedLocationId ?? undefined}
        onClose={() => setWithdrawArticle(null)}
        onSuccess={afterStockChange}
      />

      <StockReplenishDialog
        article={replenishArticle}
        locations={locations}
        defaultLocationId={selectedLocationId ?? undefined}
        onClose={() => setReplenishArticle(null)}
        onSuccess={afterStockChange}
      />

      <ArticleHistoryDialog
        articleId={historyArticle?.id ?? null}
        articleName={historyArticle?.name}
        onClose={() => setHistoryArticle(null)}
      />

      <StockAdjustDialog
        article={adjustArticle}
        locations={locations}
        defaultLocationId={selectedLocationId ?? undefined}
        onClose={() => setAdjustArticle(null)}
        onSuccess={afterStockChange}
      />

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
