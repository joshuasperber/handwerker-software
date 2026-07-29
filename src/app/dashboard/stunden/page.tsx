"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CanAccess } from "@/components/auth/can-access";
import { swrKeys, useApiSWR } from "@/lib/swr";
import {
  TIME_ENTRY_STATUS_LABELS,
  calcWorkedHours,
} from "@/lib/time-entry";
import { formatDateTime, formatEuro } from "@/lib/utils";
import { startOfWeek, endOfWeek, format, addWeeks, subWeeks } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { mutate as globalMutate } from "swr";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type TotalsRow = {
  employeeId: string;
  name: string;
  hours: number;
  laborCostNet: number | null;
  entryCount: number;
  openCount: number;
};

type EntryRow = {
  id: string;
  startTime: string;
  endTime: string | null;
  breakMinutes: number;
  activity: string | null;
  notes: string | null;
  status: string;
  hours?: number | null;
  laborCostNet?: number | null;
  employee: {
    id: string;
    hourlyWageNet?: number | null;
    user: { firstName: string; lastName: string };
  };
  order: {
    id?: string;
    orderNumber: string;
    customer: { firstName: string; lastName: string };
    project?: { id: string; name: string } | null;
  } | null;
};

type TeamHoursData = {
  totalsByEmployee: TotalsRow[];
  entries: EntryRow[];
  totalHours: number;
  totalLaborCostNet: number | null;
  employees: { id: string; name: string }[];
  orders: { id: string; orderNumber: string; title: string | null }[];
  projects: { id: string; name: string }[];
};

export default function TeamStundenPage() {
  const [weekStart, setWeekStart] = useState(
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd")
  );
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState("");
  const [orderId, setOrderId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editActivity, setEditActivity] = useState("");
  const [saving, setSaving] = useState(false);

  const from = weekStart;
  const to = format(endOfWeek(new Date(weekStart), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const qs = new URLSearchParams({ from, to });
  if (employeeId) qs.set("employeeId", employeeId);
  if (status) qs.set("status", status);
  if (orderId) qs.set("orderId", orderId);
  if (projectId) qs.set("projectId", projectId);
  if (q.trim()) qs.set("q", q.trim());

  const key = swrKeys.timeEntries(qs.toString());
  const { data, error, isLoading, mutate } = useApiSWR<TeamHoursData>(key);

  const weekLabel = useMemo(() => {
    const start = new Date(weekStart);
    const end = endOfWeek(start, { weekStartsOn: 1 });
    return `${format(start, "d. MMM", { locale: de })} – ${format(end, "d. MMM yyyy", { locale: de })}`;
  }, [weekStart]);

  async function setEntryStatus(id: string, next: string) {
    const res = await fetch(`/api/time-entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success("Status aktualisiert");
      await mutate();
      void globalMutate((k) => typeof k === "string" && k.startsWith("/api/time-entries"));
    } else {
      toast.error(json.error ?? "Fehler");
    }
  }

  function startEdit(e: EntryRow) {
    setEditingId(e.id);
    setEditNotes(e.notes ?? "");
    setEditActivity(e.activity ?? "");
  }

  async function saveEdit(id: string) {
    setSaving(true);
    const res = await fetch(`/api/time-entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activity: editActivity || null,
        notes: editNotes || null,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.success) {
      toast.success("Eintrag aktualisiert");
      setEditingId(null);
      await mutate();
    } else {
      toast.error(json.error ?? "Speichern fehlgeschlagen");
    }
  }

  async function deleteEntry(id: string) {
    const res = await fetch(`/api/time-entries/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) {
      toast.success("Eintrag gelöscht");
      await mutate();
    } else {
      toast.error(json.error ?? "Löschen fehlgeschlagen");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team-Stunden</h1>
          <p className="text-sm text-muted-foreground">
            Alle Stundenzettel einsehen, filtern, prüfen und freigeben
          </p>
        </div>
        <CanAccess permission="monteur.own">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/stundenzettel">Eigenen Stundenzettel</Link>
          </Button>
        </CanAccess>
      </div>

      <Card className="!p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() =>
                setWeekStart(format(subWeeks(new Date(weekStart), 1), "yyyy-MM-dd"))
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[10rem] text-center">
              <p className="text-sm font-semibold text-slate-900">{weekLabel}</p>
              <p className="text-xs text-slate-500">KW-Ansicht</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() =>
                setWeekStart(format(addWeeks(new Date(weekStart), 1), "yyyy-MM-dd"))
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <select
            className="h-9 rounded-lg border border-slate-300 px-2 text-sm"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            <option value="">Alle Mitarbeiter</option>
            {(data?.employees ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-lg border border-slate-300 px-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Alle Status</option>
            <option value="OPEN">Offen</option>
            <option value="REVIEWED">Geprüft</option>
            <option value="APPROVED">Freigegeben</option>
          </select>
          <select
            className="h-9 rounded-lg border border-slate-300 px-2 text-sm"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
          >
            <option value="">Alle Aufträge</option>
            {(data?.orders ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNumber}
                {o.title ? ` · ${o.title}` : ""}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-lg border border-slate-300 px-2 text-sm"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">Alle Projekte</option>
            {(data?.projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Input
            placeholder="Suche Tätigkeit / Notiz…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl bg-[#0d5c63]/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-[#0d5c63]" />
            <div>
              <p className="text-xs text-slate-500">Summe Team</p>
              <p className="text-xl font-bold text-[#0d5c63]">
                {(data?.totalHours ?? 0).toFixed(2)} h
              </p>
            </div>
          </div>
          {data?.totalLaborCostNet != null && (
            <div>
              <p className="text-xs text-slate-500">Arbeitskosten (netto)</p>
              <p className="text-lg font-semibold text-slate-800">
                {formatEuro(data.totalLaborCostNet)}
              </p>
            </div>
          )}
        </div>
      </Card>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error.message}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data?.totalsByEmployee ?? []).map((row) => (
          <Card key={row.employeeId} className="!p-4">
            <p className="font-semibold text-slate-900">{row.name}</p>
            <p className="mt-1 text-2xl font-bold text-[#0d5c63]">
              {row.hours.toFixed(2)} h
            </p>
            {row.laborCostNet != null && (
              <p className="text-sm text-slate-600">{formatEuro(row.laborCostNet)}</p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              {row.entryCount} Einträge
              {row.openCount > 0 ? ` · ${row.openCount} offen` : ""}
            </p>
          </Card>
        ))}
        {!isLoading && (data?.totalsByEmployee?.length ?? 0) === 0 && (
          <p className="text-sm text-slate-500 col-span-full">
            Keine Mitarbeiter oder keine Zeiten in dieser Woche.
          </p>
        )}
      </div>

      <Card title="Stundenzettel">
        {isLoading ? (
          <p className="py-6 text-center text-sm text-slate-500">Laden…</p>
        ) : (data?.entries?.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Keine Zeiteinträge in diesem Zeitraum.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {data!.entries.map((e) => {
              const hours =
                e.hours ?? calcWorkedHours(e.startTime, e.endTime, e.breakMinutes);
              const name = `${e.employee.user.firstName} ${e.employee.user.lastName}`.trim();
              const label = e.order
                ? `${e.order.orderNumber} · ${e.order.customer.lastName}`
                : e.activity || "Ohne Auftrag";
              return (
                <div key={e.id} className="py-3 space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{name}</p>
                      <p className="text-sm text-slate-600">{label}</p>
                      {e.activity && e.order && (
                        <p className="text-xs text-slate-500">{e.activity}</p>
                      )}
                      {e.order?.project && (
                        <p className="text-xs text-slate-400">
                          Projekt: {e.order.project.name}
                        </p>
                      )}
                      <p className="text-xs text-slate-500">
                        {formatDateTime(e.startTime)}
                        {e.endTime ? ` – ${formatDateTime(e.endTime)}` : " (offen)"}
                        {hours != null ? ` · ${hours.toFixed(2)} h` : ""}
                        {e.laborCostNet != null
                          ? ` · ${formatEuro(e.laborCostNet)}`
                          : ""}
                      </p>
                      {e.notes && (
                        <p className="text-xs text-slate-400 italic">{e.notes}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {TIME_ENTRY_STATUS_LABELS[e.status] ?? e.status}
                      </Badge>
                      <CanAccess permission="time_entries.approve">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => startEdit(e)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setDeleteId(e.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                        {e.status === "OPEN" && (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => setEntryStatus(e.id, "REVIEWED")}
                          >
                            Prüfen
                          </Button>
                        )}
                        {e.status !== "APPROVED" && (
                          <Button
                            size="xs"
                            variant="primary"
                            onClick={() => setEntryStatus(e.id, "APPROVED")}
                          >
                            Freigeben
                          </Button>
                        )}
                        {e.status === "APPROVED" && (
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => setEntryStatus(e.id, "OPEN")}
                          >
                            Zurücksetzen
                          </Button>
                        )}
                      </CanAccess>
                    </div>
                  </div>
                  {editingId === e.id && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                      <Input
                        label="Tätigkeit"
                        value={editActivity}
                        onChange={(ev) => setEditActivity(ev.target.value)}
                      />
                      <Input
                        label="Notiz"
                        value={editNotes}
                        onChange={(ev) => setEditNotes(ev.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="action"
                          disabled={saving}
                          onClick={() => saveEdit(e.id)}
                        >
                          {saving ? "Speichern…" : "Speichern"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                        >
                          Abbrechen
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Stundenzettel löschen?"
        description="Der Zeiteintrag wird unwiderruflich gelöscht."
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onConfirm={async () => {
          if (deleteId) {
            const id = deleteId;
            setDeleteId(null);
            await deleteEntry(id);
          }
        }}
      />
    </div>
  );
}
