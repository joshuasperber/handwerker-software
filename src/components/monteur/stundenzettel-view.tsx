"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { fetchJson } from "@/lib/fetch-json";
import { toast } from "sonner";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { de } from "date-fns/locale";
import { Clock, Plus, Pencil, Trash2 } from "lucide-react";
import {
  TIME_ENTRY_ACTIVITIES,
  TIME_ENTRY_STATUS_LABELS,
  calcWorkedHours,
  validateTimeEntryInput,
} from "@/lib/time-entry";
import {
  WorkDayTimeFields,
  combineDateAndTime,
  combineEndDateAndTime,
  defaultWorkDayTimes,
  splitDateTimeLocal,
  type WorkDayTimeValue,
} from "@/components/ui/work-day-time-fields";

interface TimeEntry {
  id: string;
  startTime: string;
  endTime: string | null;
  breakMinutes: number;
  activity: string | null;
  notes: string | null;
  status: string;
  order: {
    id: string;
    orderNumber: string;
    customer: { firstName: string; lastName: string };
  } | null;
}

interface OrderOption {
  id: string;
  orderNumber: string;
  title?: string | null;
  status?: string;
  customer: { firstName?: string; lastName: string };
}

type TimeForm = {
  orderId: string;
  activity: string;
  workDay: WorkDayTimeValue;
  breakMinutes: string;
  notes: string;
};

const emptyForm = (): TimeForm => ({
  orderId: "",
  activity: "",
  workDay: defaultWorkDayTimes(),
  breakMinutes: "0",
  notes: "",
});

function formStartIso(workDay: WorkDayTimeValue) {
  return combineDateAndTime(workDay.date, workDay.startTime);
}

function formEndIso(workDay: WorkDayTimeValue) {
  if (!workDay.endTime) return "";
  return combineEndDateAndTime(workDay.date, workDay.startTime, workDay.endTime);
}

function toLocalDateTimeValue(iso: string) {
  return format(new Date(iso), "yyyy-MM-dd'T'HH:mm");
}

function entryToWorkDay(entry: TimeEntry): WorkDayTimeValue {
  const start = splitDateTimeLocal(toLocalDateTimeValue(entry.startTime));
  if (!entry.endTime) {
    return { date: start.date, startTime: start.time, endTime: "" };
  }
  const end = splitDateTimeLocal(toLocalDateTimeValue(entry.endTime));
  return { date: start.date, startTime: start.time, endTime: end.time };
}

export function StundenzettelView({ title = "Stundenzettel" }: { title?: string }) {
  const [weekStart, setWeekStart] = useState(
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd")
  );
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [ordersError, setOrdersError] = useState("");
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [orderSearch, setOrderSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TimeForm>(emptyForm);
  const [form, setForm] = useState(emptyForm);

  function loadEntries() {
    const from = weekStart;
    const to = format(endOfWeek(new Date(weekStart), { weekStartsOn: 1 }), "yyyy-MM-dd");
    fetchJson<{ entries: TimeEntry[]; totalHours: number }>(
      `/api/monteur/timesheet?from=${from}&to=${to}`
    ).then((d) => {
      if (d.success && d.data) {
        setEntries(d.data.entries);
        setTotalHours(d.data.totalHours);
        setError("");
      } else {
        setError(d.error ?? "Zeiten konnten nicht geladen werden");
      }
    });
  }

  useEffect(() => {
    loadEntries();
  }, [weekStart]);

  useEffect(() => {
    setOrdersLoading(true);
    fetchJson<OrderOption[]>("/api/monteur/orders").then((d) => {
      setOrdersLoading(false);
      if (d.success && d.data) {
        setOrders(d.data);
        setOrdersError("");
      } else {
        setOrders([]);
        setOrdersError(d.error ?? "Aufträge konnten nicht geladen werden.");
      }
    });
  }, []);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => {
      const hay = `${o.orderNumber} ${o.title ?? ""} ${o.customer?.lastName ?? ""} ${o.customer?.firstName ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [orders, orderSearch]);

  const previewHours = useMemo(() => {
    const start = formStartIso(form.workDay);
    const end = formEndIso(form.workDay);
    if (!start || !end) return null;
    return calcWorkedHours(start, end, Number(form.breakMinutes) || 0);
  }, [form.workDay, form.breakMinutes]);

  function entryLabel(e: TimeEntry) {
    if (e.order) {
      return `${e.order.orderNumber} · ${e.order.customer.lastName}`;
    }
    return e.activity || "Ohne Auftrag";
  }

  function entryHours(e: TimeEntry) {
    const h = calcWorkedHours(e.startTime, e.endTime, e.breakMinutes ?? 0);
    if (h == null) return "läuft";
    return `${h.toFixed(2)} h`;
  }

  async function submitTime(e: React.FormEvent) {
    e.preventDefault();
    setFormMsg("");

    const startLocal = formStartIso(form.workDay);
    const endLocal = formEndIso(form.workDay);
    const validationError = validateTimeEntryInput({
      startTime: startLocal,
      endTime: endLocal,
      breakMinutes: Number(form.breakMinutes) || 0,
      orderId: form.orderId || null,
      activity: form.activity,
      notes: form.notes,
      requireEndTime: true,
    });
    if (validationError) {
      setFormMsg(validationError);
      return;
    }

    setSaving(true);
    const res = await fetch("/api/monteur/time", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: form.orderId || null,
        activity: form.activity.trim() || null,
        startTime: new Date(startLocal).toISOString(),
        endTime: new Date(endLocal).toISOString(),
        breakMinutes: Number(form.breakMinutes) || 0,
        notes: form.notes.trim() || undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) {
      setForm(emptyForm());
      setShowForm(false);
      setFormMsg("");
      toast.success("Stundenzettel gespeichert");
      loadEntries();
    } else {
      setFormMsg(data.error ?? "Erfassung fehlgeschlagen");
    }
  }

  function startEdit(entry: TimeEntry) {
    setEditingId(entry.id);
    setEditForm({
      orderId: entry.order?.id ?? "",
      activity: entry.activity ?? "",
      workDay: entryToWorkDay(entry),
      breakMinutes: String(entry.breakMinutes ?? 0),
      notes: entry.notes ?? "",
    });
  }

  async function saveEdit(entryId: string) {
    const startLocal = formStartIso(editForm.workDay);
    const endLocal = formEndIso(editForm.workDay);
    const validationError = validateTimeEntryInput({
      startTime: startLocal,
      endTime: endLocal || null,
      breakMinutes: Number(editForm.breakMinutes) || 0,
      orderId: editForm.orderId || null,
      activity: editForm.activity,
      notes: editForm.notes,
      requireEndTime: Boolean(editForm.workDay.endTime),
    });
    if (validationError) {
      setFormMsg(validationError);
      return;
    }

    setSaving(true);
    const res = await fetch(`/api/monteur/time/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: editForm.orderId || null,
        activity: editForm.activity.trim() || null,
        startTime: new Date(startLocal).toISOString(),
        endTime: endLocal ? new Date(endLocal).toISOString() : null,
        breakMinutes: Number(editForm.breakMinutes) || 0,
        notes: editForm.notes.trim() || null,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) {
      setEditingId(null);
      toast.success("Zeiteintrag aktualisiert");
      loadEntries();
    } else {
      setFormMsg(data.error ?? "Speichern fehlgeschlagen");
    }
  }

  async function deleteEntry(entryId: string) {
    if (!confirm("Zeiteintrag wirklich löschen?")) return;
    const res = await fetch(`/api/monteur/time/${entryId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      toast.success("Zeiteintrag gelöscht");
      loadEntries();
    } else {
      setFormMsg(data.error ?? "Löschen fehlgeschlagen");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Clock className="h-6 w-6 text-[#0d5c63]" /> {title}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Arbeitszeiten mit oder ohne Auftrag erfassen
        </p>
        <input
          type="date"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
          className="mt-2 h-10 rounded-lg border border-slate-300 px-3 text-sm"
        />
        <p className="text-xs text-slate-400 mt-1">
          Woche ab {format(new Date(weekStart), "EEEE, d. MMMM", { locale: de })}
        </p>
      </div>

      <Card className="!p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-600">Summe diese Woche</p>
            <p className="text-2xl font-bold text-[#0d5c63]">{totalHours} Stunden</p>
          </div>
          <Button
            type="button"
            variant="action"
            size="sm"
            onClick={() => {
              setFormMsg("");
              setShowForm((v) => {
                if (!v) setForm(emptyForm());
                return !v;
              });
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Zeit erfassen
          </Button>
        </div>
      </Card>

      {showForm && (
        <Card title="Neue Zeitbuchung">
          <form onSubmit={submitTime} className="space-y-3">
            <div>
              <label className="text-sm font-medium">Auftrag (optional)</label>
              {ordersLoading ? (
                <p className="text-xs text-slate-400 mt-1">Aufträge werden geladen…</p>
              ) : ordersError ? (
                <p className="text-xs text-red-600 mt-1">{ordersError}</p>
              ) : orders.length === 0 ? (
                <p className="text-xs text-amber-700 mt-1 bg-amber-50 rounded-lg px-3 py-2">
                  Keine Aufträge zur Auswahl. Du kannst die Zeit trotzdem ohne Auftrag
                  erfassen — bitte Tätigkeit oder Notiz angeben.
                </p>
              ) : (
                <>
                  {orders.length > 8 && (
                    <Input
                      className="mt-1"
                      placeholder="Auftrag suchen…"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                    />
                  )}
                  <select
                    className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
                    value={form.orderId}
                    onChange={(e) => setForm({ ...form, orderId: e.target.value })}
                  >
                    <option value="">— Ohne Auftrag —</option>
                    {filteredOrders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.orderNumber}
                        {o.customer?.lastName ? ` · ${o.customer.lastName}` : ""}
                        {o.title ? ` · ${o.title}` : ""}
                      </option>
                    ))}
                  </select>
                  {filteredOrders.length === 0 && (
                    <p className="text-xs text-slate-400 mt-1">Keine Treffer für die Suche.</p>
                  )}
                </>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">
                Tätigkeit {!form.orderId && "*"}
              </label>
              <select
                className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
                value={form.activity}
                onChange={(e) => setForm({ ...form, activity: e.target.value })}
              >
                <option value="">— wählen —</option>
                {TIME_ENTRY_ACTIVITIES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <WorkDayTimeFields
              value={form.workDay}
              onChange={(workDay) => setForm({ ...form, workDay })}
              required
            />

            <Input
              label="Pause (Minuten)"
              type="number"
              min={0}
              value={form.breakMinutes}
              onChange={(e) => setForm({ ...form, breakMinutes: e.target.value })}
            />

            {previewHours != null && (
              <p className="text-sm text-slate-600">
                Berechnete Arbeitszeit:{" "}
                <span className="font-semibold text-[#0d5c63]">{previewHours.toFixed(2)} h</span>
              </p>
            )}

            <Textarea
              label={form.orderId ? "Notiz (optional)" : "Notiz (oder Tätigkeit)"}
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />

            {formMsg && (
              <p
                className={`text-sm ${
                  formMsg.toLowerCase().includes("gespeichert") ||
                  formMsg.toLowerCase().includes("erfasst")
                    ? "text-green-700"
                    : "text-red-600"
                }`}
              >
                {formMsg}
              </p>
            )}

            <div className="flex gap-2">
              <Button type="submit" variant="action" disabled={saving}>
                {saving ? "Speichern…" : "Speichern"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Abbrechen
              </Button>
            </div>
          </form>
        </Card>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
      {formMsg && !showForm && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formMsg}</p>
      )}

      <Card>
        {entries.length === 0 ? (
          <p className="text-center text-slate-500 py-8">Keine Zeiten in dieser Woche.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {entries.map((e) => (
              <div key={e.id} className="py-3">
                {editingId === e.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium">Auftrag</label>
                      <select
                        className="w-full mt-1 h-9 rounded-lg border border-slate-300 px-2 text-sm"
                        value={editForm.orderId}
                        onChange={(ev) =>
                          setEditForm({ ...editForm, orderId: ev.target.value })
                        }
                      >
                        <option value="">— Ohne Auftrag —</option>
                        {orders.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.orderNumber} · {o.customer?.lastName ?? ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium">Tätigkeit</label>
                      <select
                        className="w-full mt-1 h-9 rounded-lg border border-slate-300 px-2 text-sm"
                        value={editForm.activity}
                        onChange={(ev) =>
                          setEditForm({ ...editForm, activity: ev.target.value })
                        }
                      >
                        <option value="">—</option>
                        {TIME_ENTRY_ACTIVITIES.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </div>
                    <WorkDayTimeFields
                      compact
                      endOptional
                      value={editForm.workDay}
                      onChange={(workDay) => setEditForm({ ...editForm, workDay })}
                    />
                    <Input
                      label="Pause (Minuten)"
                      type="number"
                      min={0}
                      value={editForm.breakMinutes}
                      onChange={(ev) =>
                        setEditForm({ ...editForm, breakMinutes: ev.target.value })
                      }
                    />
                    <Textarea
                      label="Notiz"
                      rows={2}
                      value={editForm.notes}
                      onChange={(ev) =>
                        setEditForm({ ...editForm, notes: ev.target.value })
                      }
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="action"
                        disabled={saving}
                        onClick={() => saveEdit(e.id)}
                      >
                        Speichern
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingId(null)}
                      >
                        Abbrechen
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{entryLabel(e)}</p>
                      {e.activity && e.order && (
                        <p className="text-xs text-slate-500">{e.activity}</p>
                      )}
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatDateTime(e.startTime)}
                        {e.endTime ? ` – ${formatDateTime(e.endTime)}` : " (offen)"}
                        {(e.breakMinutes ?? 0) > 0 && ` · ${e.breakMinutes} Min. Pause`}
                      </p>
                      {e.notes && (
                        <p className="text-xs text-slate-400 italic">{e.notes}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <p className="text-sm font-semibold text-[#0d5c63]">
                          {entryHours(e)}
                        </p>
                        <Badge variant="outline" className="text-[10px]">
                          {TIME_ENTRY_STATUS_LABELS[e.status] ?? e.status ?? "Offen"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(e)}
                        className="p-2 text-slate-400 hover:text-[#0d5c63]"
                        aria-label="Bearbeiten"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteEntry(e.id)}
                        className="p-2 text-slate-400 hover:text-red-600"
                        aria-label="Löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
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
