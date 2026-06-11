"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { InfoButton } from "@/components/ui/info-button";
import { Badge } from "@/components/ui/badge";
import { CanAccess } from "@/components/auth/can-access";
import { fetchJson } from "@/lib/fetch-json";
import { ShoppingCart, Package, Truck, Plus, Trash2 } from "lucide-react";

interface Suggestion {
  articleId: string;
  name: string;
  unit: string;
  available: number;
  minimumStock: number;
  suggestedQuantity: number;
  supplierName: string | null;
  source?: "auto" | "manual";
  manualId?: string;
  note?: string | null;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierName: string;
  status: string;
  orderedAt: string | null;
  expectedAt: string | null;
  lines: { id: string; quantityOrdered: number; quantityReceived: number; article: { name: string; unit: string } }[];
}

interface StorageLocation {
  id: string;
  name: string;
  locationType: string;
}

interface ArticleOption {
  id: string;
  name: string;
  unit: string;
  packageSize: number;
}

const PO_STATUS: Record<string, string> = {
  DRAFT: "Entwurf",
  ORDERED: "Bestellt",
  CONFIRMED: "Bestätigt",
  PARTLY_DELIVERED: "Teilgeliefert",
  DELIVERED: "Geliefert",
  DELAYED: "Verzögert",
  CANCELLED: "Storniert",
};

export default function EinkaufPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [articles, setArticles] = useState<ArticleOption[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualForm, setManualForm] = useState({ articleId: "", quantity: null as number | null, supplierName: "", note: "" });
  const [manualMsg, setManualMsg] = useState("");
  const [receivePo, setReceivePo] = useState<PurchaseOrder | null>(null);
  const [receiveLocationId, setReceiveLocationId] = useState("");
  const [loadError, setLoadError] = useState("");

  const load = useCallback(() => {
    Promise.all([
      fetchJson<{ suggestions: Suggestion[] }>("/api/reorder-suggestions"),
      fetchJson<PurchaseOrder[]>("/api/purchase-orders"),
      fetchJson<ArticleOption[]>("/api/articles"),
      fetchJson<StorageLocation[]>("/api/storage-locations"),
    ]).then(([s, p, a, l]) => {
      const errors = [s, p, a, l].filter((r) => !r.success).map((r) => r.error ?? "Unbekannter Fehler");
      setLoadError(errors.length ? errors.join(" · ") : "");

      if (s.success && s.data) setSuggestions(s.data.suggestions ?? []);
      if (p.success && p.data) setOrders(p.data);
      if (a.success && a.data) {
        setArticles(
          a.data.map((x) => ({
            id: x.id,
            name: x.name,
            unit: x.unit,
            packageSize: x.packageSize ?? 1,
          }))
        );
      }
      if (l.success && l.data) {
        setLocations(l.data);
        const haupt = l.data.find((loc) => loc.locationType === "HAUPTLAGER");
        if (haupt) setReceiveLocationId(haupt.id);
        else if (l.data[0]) setReceiveLocationId(l.data[0].id);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createPoFromSuggestions() {
    if (!suggestions.length) return;
    const supplier = suggestions[0].supplierName ?? "Standard-Lieferant";
    const res = await fetch("/api/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierName: supplier,
        status: "ORDERED",
        lines: suggestions.map((s) => ({
          articleId: s.articleId,
          quantityOrdered: s.suggestedQuantity,
        })),
      }),
    });
    if ((await res.json()).success) load();
  }

  async function addManualSuggestion(e: React.FormEvent) {
    e.preventDefault();
    setManualMsg("");
    const data = await fetchJson("/api/reorder-suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        articleId: manualForm.articleId,
        quantity: manualForm.quantity ?? 0,
        supplierName: manualForm.supplierName || undefined,
        note: manualForm.note || undefined,
      }),
    });
    if (data.success) {
      setManualForm({ articleId: "", quantity: null, supplierName: "", note: "" });
      setManualMsg("Bestellvorschlag angelegt");
      load();
    } else {
      setManualMsg(data.error ?? "Fehler");
    }
  }

  async function deleteManualSuggestion(manualId: string) {
    await fetch(`/api/reorder-suggestions?id=${manualId}`, { method: "DELETE" });
    load();
  }

  async function confirmReceive() {
    if (!receivePo || !receiveLocationId) return;
    const lines = receivePo.lines
      .filter((l) => l.quantityReceived < l.quantityOrdered)
      .map((l) => ({
        lineId: l.id,
        quantityReceived: l.quantityOrdered - l.quantityReceived,
      }));
    if (!lines.length) return;
    await fetch(`/api/purchase-orders/${receivePo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "receive", lines, storageLocationId: receiveLocationId }),
    });
    setReceivePo(null);
    load();
  }

  if (loading) return <p className="text-slate-500">Laden...</p>;

  const selectedManualArticle = articles.find((a) => a.id === manualForm.articleId);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingCart className="h-7 w-7 text-[#0d5c63]" />
            Einkauf
            <InfoButton title="So funktioniert der Einkauf">
              <p>Nachbestellungen vorschlagen, Bestellungen beim Lieferanten auslösen und den Wareneingang ins gewünschte Lager buchen.</p>
              <p>Mengen werden in der Artikel-Einheit erfasst (z. B. Stück, Meter, Liter); bei Gebinden zeigen wir die passende Anzahl an Verpackungseinheiten an.</p>
            </InfoButton>
          </h1>
        </div>
        <CanAccess permission="inventory.write">
          {suggestions.length > 0 && (
            <Button onClick={createPoFromSuggestions}>
              <ShoppingCart className="h-4 w-4 mr-2" />
              Bestellvorschlag übernehmen ({suggestions.length})
            </Button>
          )}
        </CanAccess>
      </div>

      {loadError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{loadError}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Bestellvorschläge">
          <CanAccess permission="inventory.write">
            <form onSubmit={addManualSuggestion} className="rounded-xl border border-slate-200 p-4 mb-4 space-y-3 bg-slate-50">
              <p className="text-sm font-medium flex items-center gap-1">
                <Plus className="h-4 w-4" /> Manuellen Bestellvorschlag anlegen
              </p>
              <select
                className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
                value={manualForm.articleId}
                onChange={(e) => setManualForm({ ...manualForm, articleId: e.target.value })}
                required
              >
                <option value="">Artikel wählen</option>
                {articles.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} (in {a.unit})
                  </option>
                ))}
              </select>
              <NumberInput
                label={`Menge${selectedManualArticle ? ` (in ${selectedManualArticle.unit})` : ""}`}
                required
                min={0}
                value={manualForm.quantity}
                onValueChange={(v) => setManualForm({ ...manualForm, quantity: v })}
              />
              {selectedManualArticle && (
                <p className="text-xs text-slate-500">
                  Bestelleinheit: {selectedManualArticle.unit}
                  {selectedManualArticle.packageSize > 1 && (
                    <>
                      {" "}· 1 Gebinde = {selectedManualArticle.packageSize}{" "}
                      {selectedManualArticle.unit}
                      {manualForm.quantity != null && manualForm.quantity > 0 && (
                        <>
                          {" "}→ ca.{" "}
                          {Math.ceil(
                            manualForm.quantity / selectedManualArticle.packageSize
                          )}{" "}
                          Gebinde
                        </>
                      )}
                    </>
                  )}
                </p>
              )}
              <Input
                label="Lieferant (optional)"
                value={manualForm.supplierName}
                onChange={(e) => setManualForm({ ...manualForm, supplierName: e.target.value })}
              />
              <Input
                label="Notiz (optional)"
                value={manualForm.note}
                onChange={(e) => setManualForm({ ...manualForm, note: e.target.value })}
              />
              <Button type="submit" size="sm" variant="action">Vorschlag speichern</Button>
              {manualMsg && <p className="text-sm text-green-700">{manualMsg}</p>}
            </form>
          </CanAccess>

          {suggestions.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">Keine Nachbestellungen nötig.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {suggestions.map((s) => (
                <div key={s.manualId ?? s.articleId} className="flex items-center justify-between py-3 gap-2">
                  <div className="min-w-0">
                    <p className="font-medium flex flex-wrap items-center gap-2">
                      {s.name}
                      {s.source === "manual" && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Manuell</span>
                      )}
                    </p>
                    <p className="text-sm text-slate-500">
                      Verfügbar: {s.available} {s.unit} · Min: {s.minimumStock}
                      {s.note && ` · ${s.note}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-sm font-semibold text-[#0d5c63]">
                        +{s.suggestedQuantity} {s.unit}
                      </span>
                      {(() => {
                        const pkg = articles.find((a) => a.id === s.articleId)?.packageSize ?? 1;
                        return pkg > 1 ? (
                          <span className="text-xs text-slate-400">
                            ≈ {Math.ceil(s.suggestedQuantity / pkg)} Gebinde à {pkg}
                          </span>
                        ) : null;
                      })()}
                    </div>
                    {s.manualId && (
                      <CanAccess permission="inventory.write">
                        <button
                          type="button"
                          onClick={() => deleteManualSuggestion(s.manualId!)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Löschen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </CanAccess>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Offene Bestellungen">
          {orders.filter((o) => !["DELIVERED", "CANCELLED"].includes(o.status)).length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">Keine offenen Bestellungen.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {orders
                .filter((o) => !["DELIVERED", "CANCELLED"].includes(o.status))
                .map((po) => (
                  <div key={po.id} className="py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium">{po.poNumber}</p>
                        <p className="text-sm text-slate-500">{po.supplierName}</p>
                      </div>
                      <Badge status={po.status} label={PO_STATUS[po.status] ?? po.status} />
                    </div>
                    <ul className="text-sm text-slate-600 mb-2">
                      {po.lines.map((l) => (
                        <li key={l.id}>
                          {l.article.name}: {l.quantityReceived}/{l.quantityOrdered} {l.article.unit}
                        </li>
                      ))}
                    </ul>
                    {po.status !== "DRAFT" && (
                      <CanAccess permission="inventory.write">
                        <Button size="sm" variant="outline" onClick={() => setReceivePo(po)}>
                          <Truck className="h-3.5 w-3.5 mr-1" /> Wareneingang buchen
                        </Button>
                      </CanAccess>
                    )}
                  </div>
                ))}
            </div>
          )}
        </Card>
      </div>

      {receivePo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold">Wareneingang – Ziellager wählen</h3>
            <p className="text-sm text-slate-600">
              Bestellung {receivePo.poNumber}: In welches Lager soll der Bestand übernommen werden?
            </p>
            <select
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
              value={receiveLocationId}
              onChange={(e) => setReceiveLocationId(e.target.value)}
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name} ({l.locationType.replace(/_/g, " ")})</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setReceivePo(null)}>Abbrechen</Button>
              <Button variant="action" onClick={confirmReceive}>Einbuchen</Button>
            </div>
          </div>
        </div>
      )}

      <Card title="Alle Bestellungen" className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="pb-2 pl-3 pr-4">Nummer</th>
                <th className="pb-2 pr-4">Lieferant</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-3">Positionen</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((po) => (
                <tr key={po.id} className="border-b border-slate-50">
                  <td className="py-2 pl-3 pr-4 font-medium">{po.poNumber}</td>
                  <td className="py-2 pr-4">{po.supplierName}</td>
                  <td className="py-2 pr-4">{PO_STATUS[po.status] ?? po.status}</td>
                  <td className="py-2 pr-3">{po.lines.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Link href="/dashboard/inventar" className="inline-flex items-center gap-1 text-sm text-[#0d5c63] mt-4 hover:underline">
          <Package className="h-4 w-4" /> Zum Inventar
        </Link>
      </Card>
    </div>
  );
}
