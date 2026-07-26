"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/auth/can-access";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export interface OrderTypeOption {
  id: string;
  name: string;
  isOther: boolean;
  isActive: boolean;
  sortOrder: number;
}

interface OrderTypeSelectProps {
  valueId: string;
  customValue: string;
  onChange: (next: {
    orderTypeId: string;
    orderTypeCustom: string;
    isOther: boolean;
    name: string;
  }) => void;
  /** Auch inaktive Typen anzeigen (z. B. bestehender Auftrag). */
  includeInactiveIds?: string[];
  showManageLink?: boolean;
  showQuickAdd?: boolean;
  label?: string;
}

export function OrderTypeSelect({
  valueId,
  customValue,
  onChange,
  includeInactiveIds = [],
  showManageLink = true,
  showQuickAdd = true,
  label = "Auftragstyp *",
}: OrderTypeSelectProps) {
  const [types, setTypes] = useState<OrderTypeOption[]>([]);
  const [quickName, setQuickName] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  function load() {
    fetch("/api/order-types?includeInactive=1")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setTypes(d.data);
      });
  }

  useEffect(() => {
    load();
  }, []);

  const visible = types.filter(
    (t) => t.isActive || includeInactiveIds.includes(t.id) || t.id === valueId
  );

  const selected = types.find((t) => t.id === valueId) ?? visible.find((t) => t.id === valueId);
  const isOther = Boolean(selected?.isOther);

  useEffect(() => {
    if (!valueId && visible.length > 0) {
      const first = visible.find((t) => t.isActive) ?? visible[0];
      onChange({
        orderTypeId: first.id,
        orderTypeCustom: first.isOther ? customValue : "",
        isOther: first.isOther,
        name: first.name,
      });
    }
    // Nur initial setzen, wenn noch keine Auswahl
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types]);

  async function quickAdd() {
    const name = quickName.trim();
    if (!name) return;
    setAdding(true);
    const res = await fetch("/api/order-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const d = await res.json();
    setAdding(false);
    if (!d.success) {
      toast.error(d.error ?? "Anlegen fehlgeschlagen");
      return;
    }
    toast.success("Auftragstyp angelegt");
    setQuickName("");
    setShowAdd(false);
    setTypes((prev) => [...prev, d.data].sort((a, b) => a.sortOrder - b.sortOrder));
    onChange({
      orderTypeId: d.data.id,
      orderTypeCustom: "",
      isOther: Boolean(d.data.isOther),
      name: d.data.name,
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-sm font-medium">{label}</label>
          {showManageLink && (
            <CanAccess permission="orders.write">
              <Link
                href="/dashboard/auftraege/typen"
                className="text-xs text-[#0d5c63] hover:underline"
              >
                Auftragstypen verwalten
              </Link>
            </CanAccess>
          )}
        </div>
        <select
          className="w-full h-10 rounded-lg border mt-1 px-3 text-sm"
          value={valueId}
          onChange={(e) => {
            const next = types.find((t) => t.id === e.target.value);
            onChange({
              orderTypeId: e.target.value,
              orderTypeCustom: next?.isOther ? customValue : "",
              isOther: Boolean(next?.isOther),
              name: next?.name ?? "",
            });
          }}
        >
          {visible.length === 0 && <option value="">Keine Typen</option>}
          {visible.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {!t.isActive ? " (deaktiviert)" : ""}
            </option>
          ))}
        </select>
      </div>

      {isOther && (
        <Input
          label="Beschreibung *"
          value={customValue}
          onChange={(e) =>
            onChange({
              orderTypeId: valueId,
              orderTypeCustom: e.target.value,
              isOther: true,
              name: selected?.name ?? "Sonstiges",
            })
          }
          placeholder="z. B. Spezialmontage Treppenhaus"
        />
      )}

      {showQuickAdd && (
        <CanAccess permission="orders.write">
          {!showAdd ? (
            <button
              type="button"
              className="text-sm text-[#0d5c63] hover:underline inline-flex items-center gap-1"
              onClick={() => setShowAdd(true)}
            >
              <Plus className="h-3.5 w-3.5" /> Auftragstyp hinzufügen
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
              <div className="flex-1">
                <Input
                  label="Neuer Auftragstyp"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  placeholder="z. B. Tür montieren"
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="action" disabled={adding} onClick={quickAdd}>
                  Speichern
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowAdd(false)}>
                  Abbrechen
                </Button>
              </div>
            </div>
          )}
        </CanAccess>
      )}
    </div>
  );
}
