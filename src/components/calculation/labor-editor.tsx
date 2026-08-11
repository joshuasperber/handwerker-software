"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import {
  calcLaborBillingTotal,
  calcLaborInternalCost,
  LABOR_INVOICE_MODES,
  summarizeLaborCostLines,
  type LaborInvoiceMode,
} from "@/lib/calculation/labor-costs";
import { formatEuro } from "@/lib/utils";
import { Users } from "lucide-react";

export type LaborEditorItem = {
  id?: string;
  employeeId?: string | null;
  description: string;
  laborType?: string;
  hours: number;
  actualHours?: number | null;
  hourlyRateNet: number;
  internalHourlyWageNet?: number | null;
  quantityWorkers?: number;
  notes?: string | null;
  isVisibleToCustomer?: boolean;
  employee?: {
    id: string;
    hourlyWageNet?: number | null;
    billingHourlyRateNet?: number | null;
    defaultActivity?: string | null;
    user: { firstName: string; lastName: string };
  } | null;
};

type EmployeeOption = {
  id: string;
  hourlyWageNet?: number | null;
  billingHourlyRateNet?: number | null;
  defaultActivity?: string | null;
  user: { firstName: string; lastName: string };
};

type LaborEditorProps = {
  items: LaborEditorItem[];
  laborInvoiceMode: LaborInvoiceMode | string;
  orderId?: string | null;
  calculationId?: string;
  defaultBillingRate?: number;
  canViewWages?: boolean;
  onChange: (items: LaborEditorItem[]) => void;
  onLaborInvoiceModeChange: (mode: LaborInvoiceMode) => void;
  onImported?: (calc: unknown) => void;
};

export function LaborEditor({
  items,
  laborInvoiceMode,
  orderId,
  calculationId,
  defaultBillingRate = 68,
  canViewWages = true,
  onChange,
  onLaborInvoiceModeChange,
  onImported,
}: LaborEditorProps) {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  useEffect(() => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setEmployees(d.data ?? []);
      })
      .catch(() => {});
  }, []);

  const list: LaborEditorItem[] = items.length
    ? items
    : [
        {
          description: "Arbeit vor Ort",
          hours: 0,
          actualHours: null,
          hourlyRateNet: defaultBillingRate,
          internalHourlyWageNet: null,
          quantityWorkers: 1,
          laborType: "ONSITE_WORK",
          isVisibleToCustomer: true,
          notes: "",
        },
      ];

  const summary = summarizeLaborCostLines(
    list.map((item) => ({
      description: item.description,
      hours: Number(item.hours) || 0,
      actualHours: item.actualHours ?? null,
      hourlyRateNet: Number(item.hourlyRateNet) || 0,
      internalHourlyWageNet: item.internalHourlyWageNet ?? null,
      quantityWorkers: item.employeeId ? 1 : Number(item.quantityWorkers ?? 1),
      totalNet: calcLaborBillingTotal({
        hours: Number(item.hours) || 0,
        hourlyRateNet: Number(item.hourlyRateNet) || 0,
        quantityWorkers: item.employeeId ? 1 : Number(item.quantityWorkers ?? 1),
      }),
      isVisibleToCustomer: item.isVisibleToCustomer !== false,
    }))
  );

  function update(index: number, patch: Partial<LaborEditorItem>) {
    const next = list.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange(next);
  }

  function applyEmployee(index: number, employeeId: string) {
    if (!employeeId) {
      update(index, { employeeId: null, employee: null });
      return;
    }
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) {
      update(index, { employeeId });
      return;
    }
    const name = `${emp.user.firstName} ${emp.user.lastName}`.trim();
    update(index, {
      employeeId: emp.id,
      quantityWorkers: 1,
      description:
        list[index].description?.trim() && !list[index].description.startsWith("Arbeitszeit")
          ? list[index].description
          : emp.defaultActivity?.trim() || `Arbeitszeit ${name}`,
      hourlyRateNet: emp.billingHourlyRateNet ?? list[index].hourlyRateNet ?? defaultBillingRate,
      internalHourlyWageNet: emp.hourlyWageNet ?? null,
      employee: emp,
    });
  }

  async function importFromTimesheet() {
    if (!calculationId || !orderId) return;
    setImporting(true);
    setImportMsg("");
    try {
      const res = await fetch(`/api/calculations/${calculationId}/import-time`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.success) {
        setImportMsg(data.error ?? "Übernahme fehlgeschlagen");
        return;
      }
      setImportMsg(
        `${data.data.imported} Mitarbeiterposition(en) aus dem Stundenzettel übernommen.`
      );
      onImported?.(data.data.calculation);
    } catch {
      setImportMsg("Übernahme fehlgeschlagen");
    } finally {
      setImporting(false);
    }
  }

  const mode = (["INTERNAL", "ITEMIZED", "SUMMARIZED"].includes(String(laborInvoiceMode))
    ? laborInvoiceMode
    : "ITEMIZED") as LaborInvoiceMode;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
        <p className="text-sm font-medium text-slate-800 flex items-center gap-2">
          <Users className="h-4 w-4" /> Mitarbeiter &amp; Arbeitszeit
        </p>
        <p className="text-xs text-slate-500">
          Geplante Stunden steuern den Verkaufspreis. Tatsächliche Stunden und interner Lohn dienen
          der Kostenkontrolle. Bei Festpreis bleiben Arbeitszeiten intern.
        </p>
        {orderId && calculationId && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={importing}
            onClick={importFromTimesheet}
          >
            {importing ? "Übernehme…" : "Ist-Stunden aus Stundenzettel übernehmen"}
          </Button>
        )}
        {importMsg && <p className="text-xs text-slate-600">{importMsg}</p>}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-600">Darstellung auf Angebot / Rechnung</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {LABOR_INVOICE_MODES.map((m) => (
            <label
              key={m.value}
              className={`flex items-start gap-2 rounded-lg border p-2.5 text-sm cursor-pointer ${
                mode === m.value ? "border-[#0d5c63] bg-[#0d5c63]/5" : "border-slate-200 bg-white"
              }`}
            >
              <input
                type="radio"
                name="laborInvoiceMode"
                className="mt-1"
                checked={mode === m.value}
                onChange={() => onLaborInvoiceModeChange(m.value)}
              />
              <span>
                <span className="font-medium block">{m.label}</span>
                <span className="text-xs text-slate-500">{m.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <div className="rounded border bg-white p-2">
          <p className="text-xs text-slate-500">Geplant</p>
          <p className="font-semibold">{summary.plannedHours.toFixed(2)} Std.</p>
        </div>
        <div className="rounded border bg-white p-2">
          <p className="text-xs text-slate-500">Tatsächlich</p>
          <p className="font-semibold">
            {summary.actualHours != null ? `${summary.actualHours.toFixed(2)} Std.` : "—"}
          </p>
        </div>
        <div className="rounded border bg-white p-2">
          <p className="text-xs text-slate-500">Abweichung</p>
          <p
            className={`font-semibold ${
              summary.deltaHours != null && summary.deltaHours > 0
                ? "text-amber-700"
                : summary.deltaHours != null && summary.deltaHours < 0
                  ? "text-green-700"
                  : ""
            }`}
          >
            {summary.deltaHours != null
              ? `${summary.deltaHours > 0 ? "+" : ""}${summary.deltaHours.toFixed(2)} Std.`
              : "—"}
          </p>
        </div>
        <div className="rounded border bg-white p-2">
          <p className="text-xs text-slate-500">Verkauf (netto)</p>
          <p className="font-semibold">{formatEuro(summary.billingTotal)}</p>
        </div>
        {canViewWages && (
          <div className="rounded border bg-white p-2 col-span-2 sm:col-span-4">
            <p className="text-xs text-slate-500">Interne Personalkosten</p>
            <p className="font-semibold">
              {summary.internalTotal != null ? formatEuro(summary.internalTotal) : "— (Löhne fehlen)"}
              {summary.costDelta != null && summary.costDelta !== 0 && (
                <span
                  className={`ml-2 text-sm ${
                    summary.costDelta > 0 ? "text-amber-700" : "text-green-700"
                  }`}
                >
                  ({summary.costDelta > 0 ? "+" : ""}
                  {formatEuro(summary.costDelta)} vs. geplant)
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {list.map((item, i) => {
          const workers = item.employeeId ? 1 : Number(item.quantityWorkers ?? 1);
          const billable = calcLaborBillingTotal({
            hours: Number(item.hours) || 0,
            hourlyRateNet: Number(item.hourlyRateNet) || 0,
            quantityWorkers: workers,
          });
          const internal = calcLaborInternalCost({
            hours: Number(item.hours) || 0,
            actualHours: item.actualHours,
            internalHourlyWageNet: item.internalHourlyWageNet,
            quantityWorkers: workers,
          });
          return (
            <div key={item.id ?? i} className="rounded-xl border border-slate-200 p-3 space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Mitarbeiter</label>
                  <select
                    className="mt-1 h-10 w-full rounded-2xl border border-slate-300 px-3 text-sm"
                    value={item.employeeId ?? ""}
                    onChange={(e) => applyEmployee(i, e.target.value)}
                  >
                    <option value="">Ohne Zuordnung</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.user.firstName} {e.user.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Tätigkeit / Beschreibung"
                  value={item.description}
                  onChange={(e) => update(i, { description: e.target.value })}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <NumberInput
                  label="Geplante Stunden"
                  min={0}
                  value={item.hours}
                  onValueChange={(v) => update(i, { hours: v ?? 0 })}
                />
                <NumberInput
                  label="Tatsächliche Stunden"
                  min={0}
                  value={item.actualHours ?? undefined}
                  onValueChange={(v) => update(i, { actualHours: v })}
                />
                <NumberInput
                  label="Verrechnungssatz"
                  suffix="€"
                  min={0}
                  value={item.hourlyRateNet}
                  onValueChange={(v) => update(i, { hourlyRateNet: v ?? 0 })}
                />
                {canViewWages ? (
                  <NumberInput
                    label="Interner Stundenlohn"
                    suffix="€"
                    min={0}
                    value={item.internalHourlyWageNet ?? undefined}
                    onValueChange={(v) => update(i, { internalHourlyWageNet: v })}
                  />
                ) : (
                  <div className="text-xs text-slate-500 flex items-end pb-2">
                    Interner Lohn nur für berechtigte Nutzer
                  </div>
                )}
              </div>
              {!item.employeeId && (
                <NumberInput
                  label="Anzahl Mitarbeiter (ohne Einzelzuordnung)"
                  allowDecimal={false}
                  min={1}
                  value={item.quantityWorkers ?? 1}
                  onValueChange={(v) => update(i, { quantityWorkers: v ?? 1 })}
                />
              )}
              <Input
                label="Notiz"
                value={item.notes ?? ""}
                onChange={(e) => update(i, { notes: e.target.value })}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={item.isVisibleToCustomer !== false}
                    onChange={(e) => update(i, { isVisibleToCustomer: e.target.checked })}
                    disabled={mode === "INTERNAL"}
                  />
                  Auf Dokument sichtbar (bei Einzelpositionen)
                </label>
                <div className="text-right text-slate-700">
                  <span className="font-medium">{formatEuro(billable)}</span>
                  {canViewWages && internal != null && (
                    <span className="block text-xs text-slate-500">
                      Intern {formatEuro(internal)}
                    </span>
                  )}
                </div>
              </div>
              {list.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-red-600"
                  onClick={() => onChange(list.filter((_, idx) => idx !== i))}
                >
                  Position entfernen
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange([
            ...list,
            {
              description: "Arbeitszeit",
              hours: 0,
              actualHours: null,
              hourlyRateNet: defaultBillingRate,
              internalHourlyWageNet: null,
              quantityWorkers: 1,
              laborType: "ONSITE_WORK",
              isVisibleToCustomer: true,
              notes: "",
            },
          ])
        }
      >
        + Mitarbeiter / Arbeitsposition
      </Button>
    </div>
  );
}
