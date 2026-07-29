"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CanAccess } from "@/components/auth/can-access";
import { AddButton } from "@/components/ui/add-button";
import { saveJson } from "@/lib/save-toast";
import { ArrowDown, ArrowLeft, ArrowUp, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface OrderTypeRow {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  isOther: boolean;
  legacyKey: string | null;
  _count: { orders: number };
}

export default function AuftragstypenPage() {
  const [items, setItems] = useState<OrderTypeRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [asOther, setAsOther] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [removeTarget, setRemoveTarget] = useState<OrderTypeRow | null>(null);

  function load() {
    fetch("/api/order-types?includeInactive=1")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setItems(d.data);
      });
  }

  useEffect(() => {
    load();
  }, []);

  async function createType(e: React.FormEvent) {
    e.preventDefault();
    const res = await saveJson("/api/order-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, isOther: asOther }),
    });
    if (res.success) {
      setShowForm(false);
      setName("");
      setAsOther(false);
      load();
    }
  }

  async function saveEdit(id: string) {
    const trimmed = editName.trim();
    if (!trimmed) return;
    setBusyId(id);
    const res = await fetch(`/api/order-types/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    const d = await res.json();
    setBusyId(null);
    if (!d.success) {
      toast.error(d.error ?? "Speichern fehlgeschlagen");
      return;
    }
    toast.success("Auftragstyp umbenannt");
    setEditingId(null);
    load();
  }

  async function removeType(item: OrderTypeRow) {
    setBusyId(item.id);
    const res = await fetch(`/api/order-types/${item.id}`, { method: "DELETE" });
    const d = await res.json();
    setBusyId(null);
    if (!d.success) {
      toast.error(d.error ?? "Löschen fehlgeschlagen");
      return;
    }
    toast.success(d.data.message ?? "Erledigt");
    load();
  }

  async function reactivate(item: OrderTypeRow) {
    setBusyId(item.id);
    const res = await fetch(`/api/order-types/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    const d = await res.json();
    setBusyId(null);
    if (d.success) {
      toast.success("Auftragstyp wieder aktiviert");
      load();
    } else {
      toast.error(d.error ?? "Aktivieren fehlgeschlagen");
    }
  }

  async function move(item: OrderTypeRow, direction: -1 | 1) {
    const active = items.filter((i) => i.isActive);
    const idx = active.findIndex((i) => i.id === item.id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= active.length) return;

    const orderedIds = active.map((i) => i.id);
    const tmp = orderedIds[idx];
    orderedIds[idx] = orderedIds[swapIdx];
    orderedIds[swapIdx] = tmp;

    setBusyId(item.id);
    const res = await fetch("/api/order-types/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });
    const d = await res.json();
    setBusyId(null);
    if (d.success) setItems(d.data);
    else toast.error(d.error ?? "Reihenfolge speichern fehlgeschlagen");
  }

  const active = items.filter((i) => i.isActive);
  const inactive = items.filter((i) => !i.isActive);
  const hasOther = items.some((i) => i.isOther);

  function TypeRow({ item, canReorder }: { item: OrderTypeRow; canReorder: boolean }) {
    const isEditing = editingId === item.id;
    return (
      <div
        className={`flex flex-col sm:flex-row sm:items-center gap-3 py-3 border-b border-slate-100 last:border-0 ${
          !item.isActive ? "opacity-75" : ""
        }`}
      >
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="action"
                  disabled={busyId === item.id}
                  onClick={() => saveEdit(item.id)}
                >
                  Speichern
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                  Abbrechen
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="font-medium text-slate-900">{item.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {item.isOther ? "Sonstiges · Freitextfeld" : "Standard"}
                {item._count.orders > 0
                  ? ` · ${item._count.orders} Auftrag/Aufträge`
                  : " · nicht verwendet"}
                {!item.isActive ? " · deaktiviert" : ""}
              </p>
            </>
          )}
        </div>
        {!isEditing && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canReorder && item.isActive && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === item.id}
                  aria-label="Nach oben"
                  onClick={() => move(item, -1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === item.id}
                  aria-label="Nach unten"
                  onClick={() => move(item, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </>
            )}
            <CanAccess permission="orders.write">
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label="Bearbeiten"
                onClick={() => {
                  setEditingId(item.id);
                  setEditName(item.name);
                }}
              >
                <Pencil className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Bearbeiten</span>
              </Button>
              {item.isActive ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  disabled={busyId === item.id}
                  onClick={() => setRemoveTarget(item)}
                >
                  <Trash2 className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">
                    {item._count.orders > 0 ? "Deaktivieren" : "Löschen"}
                  </span>
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === item.id}
                  onClick={() => reactivate(item)}
                >
                  <RotateCcw className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Aktivieren</span>
                </Button>
              )}
            </CanAccess>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/dashboard/auftraege"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-[#0d5c63]"
        >
          <ArrowLeft className="h-4 w-4" /> Zurück zu Aufträgen
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Auftragstypen</h1>
          <p className="text-sm text-slate-500 mt-1">
            Eigene Typen pflegen – unbenutzte löschen, genutzte deaktivieren. Bestehende Aufträge
            behalten ihren gespeicherten Typennamen.
          </p>
        </div>
        <CanAccess permission="orders.write">
          <AddButton onClick={() => setShowForm(!showForm)}>Auftragstyp hinzufügen</AddButton>
        </CanAccess>
      </div>

      <CanAccess permission="orders.write">
        {showForm && (
          <Card title="Neuer Auftragstyp" className="mb-6">
            <form onSubmit={createType} className="space-y-3">
              <Input
                label="Bezeichnung *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z. B. Tür montieren"
                required
              />
              {!hasOther && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={asOther}
                    onChange={(e) => setAsOther(e.target.checked)}
                  />
                  Als „Sonstiges“ mit Freitextfeld
                </label>
              )}
              <Button type="submit" variant="action">
                Anlegen
              </Button>
            </form>
          </Card>
        )}
      </CanAccess>

      <Card title="Aktive Typen">
        {active.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">Noch keine aktiven Auftragstypen.</p>
        ) : (
          active.map((item) => <TypeRow key={item.id} item={item} canReorder />)
        )}
      </Card>

      {inactive.length > 0 && (
        <Card title="Deaktivierte Typen" className="mt-6">
          {inactive.map((item) => (
            <TypeRow key={item.id} item={item} canReorder={false} />
          ))}
        </Card>
      )}

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title={
          removeTarget && removeTarget._count.orders > 0
            ? "Auftragstyp deaktivieren?"
            : "Auftragstyp löschen?"
        }
        description={
          removeTarget
            ? removeTarget._count.orders > 0
              ? `„${removeTarget.name}“ wird in ${removeTarget._count.orders} Auftrag/Aufträgen verwendet und daher deaktiviert. Bestehende Aufträge bleiben erhalten.`
              : `„${removeTarget.name}“ wird endgültig gelöscht.`
            : ""
        }
        confirmLabel={
          removeTarget && removeTarget._count.orders > 0 ? "Deaktivieren" : "Löschen"
        }
        cancelLabel="Abbrechen"
        variant="destructive"
        onConfirm={async () => {
          if (removeTarget) {
            const target = removeTarget;
            setRemoveTarget(null);
            await removeType(target);
          }
        }}
      />
    </div>
  );
}
