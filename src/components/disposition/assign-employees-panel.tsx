"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";

interface EmployeeOption {
  id: string;
  name: string;
  available: boolean;
  onAbsence: boolean;
}

interface PhaseOption {
  id: string;
  name: string;
}

interface AssignEmployeesPanelProps {
  orderId: string;
  orderNumber?: string;
  phases?: PhaseOption[];
  defaultStart?: string | null;
  defaultEnd?: string | null;
  preselectedEmployeeIds?: string[];
  onAssigned?: () => void;
  onClose?: () => void;
  compact?: boolean;
}

export function AssignEmployeesPanel({
  orderId,
  orderNumber,
  phases = [],
  defaultStart,
  defaultEnd,
  preselectedEmployeeIds = [],
  onAssigned,
  onClose,
  compact = false,
}: AssignEmployeesPanelProps) {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(preselectedEmployeeIds));
  const [phaseId, setPhaseId] = useState("");
  const [startTime, setStartTime] = useState(defaultStart?.slice(0, 16) ?? "");
  const [endTime, setEndTime] = useState(defaultEnd?.slice(0, 16) ?? "");
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/disposition/availability")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setEmployees(
            d.data.employees.map((e: { id: string; name: string; available: boolean; onAbsence: boolean }) => ({
              id: e.id,
              name: e.name,
              available: e.available,
              onAbsence: e.onAbsence,
            }))
          );
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function toggleEmployee(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (!selected.size) {
      toast.error("Mindestens einen Mitarbeiter wählen");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/orders/${orderId}/assign-employees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeIds: [...selected],
        phaseId: phaseId || undefined,
        startTime: startTime ? new Date(startTime).toISOString() : undefined,
        endTime: endTime ? new Date(endTime).toISOString() : undefined,
        notify,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) {
      const { created, updated, conflicts, skipped } = data.data;
      if (conflicts?.length) {
        toast.warning(`${conflicts.length} Konflikt(e): ${conflicts[0].message}`);
      }
      if (created?.length || updated?.length) {
        toast.success(`${created?.length ?? 0} neu, ${updated?.length ?? 0} aktualisiert`);
      } else if (skipped?.length) {
        toast.info("Phase zugewiesen (ohne Kalendertermin)");
      }
      onAssigned?.();
      onClose?.();
    } else {
      toast.error(data.error ?? "Zuweisung fehlgeschlagen");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Laden…
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {orderNumber && (
        <p className="text-sm font-medium text-[#0d5c63]">
          Auftrag {orderNumber}
        </p>
      )}

      <div>
        <p className="text-xs font-medium text-slate-500 mb-2">Mitarbeiter</p>
        <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-slate-200 p-2">
          {employees.map((e) => (
            <label
              key={e.id}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-slate-50 ${
                e.onAbsence ? "opacity-60" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(e.id)}
                onChange={() => toggleEmployee(e.id)}
                className="rounded border-slate-300"
              />
              <span className="flex-1">{e.name}</span>
              <span className={`text-[10px] ${e.available ? "text-green-600" : "text-amber-600"}`}>
                {e.onAbsence ? "Abwesend" : e.available ? "Frei" : "Im Einsatz"}
              </span>
            </label>
          ))}
        </div>
      </div>

      {phases.length > 0 && (
        <div>
          <label className="text-xs font-medium text-slate-500">Phase (optional)</label>
          <select
            className="mt-1 w-full h-9 rounded-lg border border-slate-300 px-2 text-sm"
            value={phaseId}
            onChange={(e) => setPhaseId(e.target.value)}
          >
            <option value="">— Keine Phase —</option>
            {phases.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-slate-500">Beginn (optional)</label>
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="mt-1 w-full h-9 rounded-lg border border-slate-300 px-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Ende (optional)</label>
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="mt-1 w-full h-9 rounded-lg border border-slate-300 px-2 text-sm"
          />
        </div>
      </div>
      <p className="text-[11px] text-slate-400">
        Ohne Termin: nur Phase-Zuweisung. Mit Termin: Kalendereintrag pro Mitarbeiter.
      </p>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        Monteur benachrichtigen
      </label>

      <div className="flex gap-2 justify-end">
        {onClose && (
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Abbrechen
          </Button>
        )}
        <Button size="sm" onClick={submit} disabled={saving || !selected.size}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
          Zuweisen
        </Button>
      </div>
    </div>
  );
}

export function AssignOrderButton({
  orderId,
  orderNumber,
  phases,
  defaultStart,
  defaultEnd,
  preselectedEmployeeIds,
  onAssigned,
}: Omit<AssignEmployeesPanelProps, "onClose" | "compact">) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4 mr-1" />
        Zuweisen
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-lg mb-4">Mitarbeiter zuweisen</h3>
            <AssignEmployeesPanel
              key={`${orderId}-${(preselectedEmployeeIds ?? []).join(",")}`}
              orderId={orderId}
              orderNumber={orderNumber}
              phases={phases}
              defaultStart={defaultStart}
              defaultEnd={defaultEnd}
              preselectedEmployeeIds={preselectedEmployeeIds}
              onAssigned={() => {
                onAssigned?.();
                setOpen(false);
              }}
              onClose={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
