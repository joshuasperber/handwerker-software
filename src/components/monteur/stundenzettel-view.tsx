"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { fetchJson } from "@/lib/fetch-json";
import { toast } from "sonner";
import {
  addDays,
  format,
  startOfWeek,
  endOfWeek,
  subDays,
} from "date-fns";
import { de } from "date-fns/locale";
import {
  Clock,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  TIME_ENTRY_ACTIVITIES,
  TIME_ENTRY_ACTIVITY_SONSTIGES,
  TIME_ENTRY_STATUS_LABELS,
  calcWorkedHours,
  isSonstigesActivity,
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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

type OrderScope = "mine" | "all";

type TimeForm = {
  orderId: string;
  activity: string;
  activityCustom: string;
  workDay: WorkDayTimeValue;
  breakMinutes: string;
  notes: string;
};

const emptyForm = (date?: string): TimeForm => ({
  orderId: "",
  activity: "",
  activityCustom: "",
  workDay: { ...defaultWorkDayTimes(), ...(date ? { date } : {}) },
  breakMinutes: "0",
  notes: "",
});

function todayInput() {
  return format(new Date(), "yyyy-MM-dd");
}

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

function activitySelectValue(activity: string | null): {
  activity: string;
  activityCustom: string;
} {
  if (!activity) return { activity: "", activityCustom: "" };
  if ((TIME_ENTRY_ACTIVITIES as readonly string[]).includes(activity)) {
    return { activity, activityCustom: "" };
  }
  return { activity: TIME_ENTRY_ACTIVITY_SONSTIGES, activityCustom: activity };
}

export function StundenzettelView({ title = "Stundenzettel" }: { title?: string }) {
  const searchParams = useSearchParams();
  const [dayDate, setDayDate] = useState(todayInput);
  const [dayPanelOpen, setDayPanelOpen] = useState(true);
  const [orderScope, setOrderScope] = useState<OrderScope>("all");
  const [weekStart, setWeekStart] = useState(
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd")
  );
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [ordersError, setOrdersError] = useState("");
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [missingEmployeeProfile, setMissingEmployeeProfile] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TimeForm>(emptyForm);
  const [form, setForm] = useState(() => emptyForm(todayInput()));
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const orderId = searchParams.get("orderId");
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    if (!orderId && !start) return;

    const workDay = { ...defaultWorkDayTimes() };
    if (start) {
      const s = splitDateTimeLocal(toLocalDateTimeValue(start));
      workDay.date = s.date;
      workDay.startTime = s.time;
      setDayDate(s.date);
      setWeekStart(format(startOfWeek(new Date(s.date), { weekStartsOn: 1 }), "yyyy-MM-dd"));
    }
    if (end) {
      const e = splitDateTimeLocal(toLocalDateTimeValue(end));
      workDay.endTime = e.time;
    }

    setForm({
      ...emptyForm(workDay.date),
      orderId: orderId ?? "",
      workDay,
    });
    setShowForm(true);
    setDayPanelOpen(true);
  }, [searchParams]);

  const loadEntries = useCallback(() => {
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
  }, [weekStart]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    setOrdersLoading(true);
    fetchJson<{
      orders: OrderOption[];
      canViewAll?: boolean;
      missingEmployeeProfile?: boolean;
    } | OrderOption[]>(`/api/monteur/orders?scope=${orderScope}`).then((d) => {
      setOrdersLoading(false);
      if (d.success && d.data) {
        const list = Array.isArray(d.data) ? d.data : d.data.orders ?? [];
        setOrders(list);
        setMissingEmployeeProfile(
          !Array.isArray(d.data) && Boolean(d.data.missingEmployeeProfile)
        );
        setOrdersError("");
      } else {
        setOrders([]);
        setOrdersError(d.error ?? "Aufträge konnten nicht geladen werden.");
      }
    });
  }, [orderScope]);

  const dayEntries = useMemo(() => {
    return entries.filter((e) => {
      const d = format(new Date(e.startTime), "yyyy-MM-dd");
      return d === dayDate;
    });
  }, [entries, dayDate]);

  const dayHours = useMemo(() => {
    return dayEntries.reduce((sum, e) => {
      const h = calcWorkedHours(e.startTime, e.endTime, e.breakMinutes ?? 0);
      return sum + (h ?? 0);
    }, 0);
  }, [dayEntries]);

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

  function openCreateForm() {
    setFormMsg("");
    setEditingId(null);
    setForm(emptyForm(dayDate));
    setShowForm(true);
    setDayPanelOpen(true);
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
      activityCustom: form.activityCustom,
      notes: form.notes,
      requireEndTime: true,
    });
    if (validationError) {
      setFormMsg(validationError);
      toast.error(validationError);
      return;
    }

    setSaving(true);
    const res = await fetch("/api/monteur/time", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: form.orderId || null,
        activity: form.activity || null,
        activityCustom: form.activityCustom || null,
        startTime: new Date(startLocal).toISOString(),
        endTime: new Date(endLocal).toISOString(),
        breakMinutes: Number(form.breakMinutes) || 0,
        notes: form.notes.trim() || undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) {
      setForm(emptyForm(dayDate));
      setShowForm(false);
      setFormMsg("");
      toast.success("Stundenzettel gespeichert");
      loadEntries();
    } else {
      setFormMsg(data.error ?? "Erfassung fehlgeschlagen");
      toast.error(data.error ?? "Erfassung fehlgeschlagen");
    }
  }

  function startEdit(entry: TimeEntry) {
    const act = activitySelectValue(entry.activity);
    setEditingId(entry.id);
    setEditForm({
      orderId: entry.order?.id ?? "",
      activity: act.activity,
      activityCustom: act.activityCustom,
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
      activityCustom: editForm.activityCustom,
      notes: editForm.notes,
      requireEndTime: Boolean(editForm.workDay.endTime),
    });
    if (validationError) {
      setFormMsg(validationError);
      toast.error(validationError);
      return;
    }

    setSaving(true);
    const res = await fetch(`/api/monteur/time/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: editForm.orderId || null,
        activity: editForm.activity || null,
        activityCustom: editForm.activityCustom || null,
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
      toast.error(data.error ?? "Speichern fehlgeschlagen");
    }
  }

  async function deleteEntry(entryId: string) {
    const res = await fetch(`/api/monteur/time/${entryId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      toast.success("Zeiteintrag gelöscht");
      loadEntries();
    } else {
      setFormMsg(data.error ?? "Löschen fehlgeschlagen");
    }
  }

  function renderActivityFields(
    value: TimeForm,
    onChange: (next: TimeForm) => void,
    compact = false
  ) {
    const showCustom =
      value.activity === TIME_ENTRY_ACTIVITY_SONSTIGES ||
      isSonstigesActivity(value.activityCustom);

    return (
      <>
        <div>
          <label className={`${compact ? "text-xs" : "text-sm"} font-medium`}>
            Tätigkeit {!value.orderId && "*"}
          </label>
          <select
            className={`w-full mt-1 rounded-lg border border-slate-300 px-3 text-sm ${compact ? "h-9" : "h-10"}`}
            value={value.activity}
            onChange={(e) =>
              onChange({
                ...value,
                activity: e.target.value,
                activityCustom:
                  e.target.value === TIME_ENTRY_ACTIVITY_SONSTIGES
                    ? value.activityCustom
                    : "",
              })
            }
          >
            <option value="">— wählen —</option>
            {TIME_ENTRY_ACTIVITIES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        {showCustom && (
          <Input
            label="Tätigkeit beschreiben *"
            value={value.activityCustom}
            onChange={(e) => onChange({ ...value, activityCustom: e.target.value })}
            placeholder="z. B. Sonderanfertigung vor Ort"
            required
          />
        )}
      </>
    );
  }

  function renderOrderSelect(
    value: string,
    onChange: (orderId: string) => void,
    compact = false
  ) {
    return (
      <div>
        <label className={`${compact ? "text-xs" : "text-sm"} font-medium`}>
          Auftrag (optional)
        </label>
        {ordersLoading ? (
          <p className="text-xs text-slate-400 mt-1">Aufträge werden geladen…</p>
        ) : ordersError ? (
          <p className="text-xs text-red-600 mt-1">{ordersError}</p>
        ) : orders.length === 0 ? (
          <p className="text-xs text-amber-700 mt-1 bg-amber-50 rounded-lg px-3 py-2">
            {orderScope === "mine"
              ? "Keine eigenen Aufträge. Wechsle zu „Alle Aufträge“ oder erfasse ohne Auftrag."
              : "Keine Aufträge zur Auswahl. Zeit ohne Auftrag erfassen — Tätigkeit oder Notiz angeben."}
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
              className={`w-full mt-1 rounded-xl border border-slate-300 px-3 text-sm bg-white ${compact ? "h-10" : "h-12"}`}
              value={value}
              onChange={(e) => onChange(e.target.value)}
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
          </>
        )}
      </div>
    );
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
      </div>

      {missingEmployeeProfile && (
        <p className="text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
          Für dieses Konto fehlt ein Mitarbeiterprofil. Aufträge können angezeigt werden,
          Zeiterfassung speichern funktioniert erst nach Anlage unter „Mitarbeiter“.
        </p>
      )}

      <Card className="!p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-600">Summe diese Woche</p>
            <p className="text-2xl font-bold text-[#0d5c63]">{totalHours} Stunden</p>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="mt-2 h-9 rounded-lg border border-slate-300 px-3 text-sm"
            />
          </div>
          <Button type="button" variant="action" onClick={openCreateForm} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-1" />
            Tätigkeit ausführen
          </Button>
        </div>
      </Card>

      {/* Tagesansicht */}
      <Card className="!p-0 overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50"
          onClick={() => setDayPanelOpen((v) => !v)}
        >
          <div>
            <p className="text-sm font-semibold text-slate-800">Tagesansicht</p>
            <p className="text-xs text-slate-500">
              {format(new Date(dayDate + "T12:00:00"), "EEEE, d. MMMM yyyy", { locale: de })}
              {" · "}
              {dayHours.toFixed(2)} h · {dayEntries.length} Einträge
            </p>
          </div>
          {dayPanelOpen ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </button>

        {dayPanelOpen && (
          <div className="border-t border-slate-100 px-4 py-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() =>
                  setDayDate(format(subDays(new Date(dayDate + "T12:00:00"), 1), "yyyy-MM-dd"))
                }
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <input
                type="date"
                value={dayDate}
                onChange={(e) => setDayDate(e.target.value)}
                className="h-9 flex-1 rounded-lg border border-slate-300 px-3 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() =>
                  setDayDate(format(addDays(new Date(dayDate + "T12:00:00"), 1), "yyyy-MM-dd"))
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDayDate(todayInput())}
              >
                Heute
              </Button>
            </div>

            {dayEntries.length === 0 ? (
              <p className="text-sm text-slate-500 py-2 text-center">
                Keine Tätigkeiten an diesem Tag.
              </p>
            ) : (
              <div className="divide-y divide-slate-50">
                {dayEntries.map((e) => (
                  <div key={e.id} className="py-2 flex justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{entryLabel(e)}</p>
                      {e.activity && (
                        <p className="text-xs text-slate-500">{e.activity}</p>
                      )}
                      <p className="text-xs text-slate-400">
                        {formatDateTime(e.startTime)}
                        {e.endTime ? ` – ${format(new Date(e.endTime), "HH:mm")}` : ""}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-[#0d5c63] shrink-0">
                      {entryHours(e)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {showForm && (
        <Card title="Tätigkeit ausführen">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex rounded-xl border border-slate-200 p-1 text-sm bg-slate-50/80 w-full sm:w-auto">
              <button
                type="button"
                className={`flex-1 sm:flex-none rounded-lg px-3 py-2.5 min-h-11 font-medium transition-[transform,background-color] active:scale-[0.98] touch-manipulation ${
                  orderScope === "mine" ? "bg-[#0d5c63] text-white shadow-sm" : "text-slate-600"
                }`}
                onClick={() => setOrderScope("mine")}
              >
                Meine Aufträge
              </button>
              <button
                type="button"
                className={`flex-1 sm:flex-none rounded-lg px-3 py-2.5 min-h-11 font-medium transition-[transform,background-color] active:scale-[0.98] touch-manipulation ${
                  orderScope === "all" ? "bg-[#0d5c63] text-white shadow-sm" : "text-slate-600"
                }`}
                onClick={() => setOrderScope("all")}
              >
                Alle Aufträge
              </button>
            </div>
            {!ordersLoading && !ordersError && (
              <p className="text-xs text-slate-500 px-1">
                {orders.length} Auftrag{orders.length === 1 ? "" : "e"} · neueste zuerst
              </p>
            )}
          </div>

          <form onSubmit={submitTime} className="space-y-3">
            {renderOrderSelect(form.orderId, (orderId) => setForm({ ...form, orderId }))}
            {renderActivityFields(form, setForm)}

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
                <span className="font-semibold text-[#0d5c63]">
                  {previewHours.toFixed(2)} h
                </span>
              </p>
            )}

            <Textarea
              label={form.orderId ? "Notiz (optional)" : "Notiz (oder Tätigkeit)"}
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />

            {formMsg && <p className="text-sm text-red-600">{formMsg}</p>}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" variant="action" disabled={saving} className="w-full sm:w-auto">
                {saving ? "Speichern…" : "Speichern"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
                className="w-full sm:w-auto"
              >
                Abbrechen
              </Button>
            </div>
          </form>
        </Card>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <Card title="Wochenübersicht">
        {entries.length === 0 ? (
          <p className="text-center text-slate-500 py-8">Keine Zeiten in dieser Woche.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {entries.map((e) => (
              <div key={e.id} className="py-3">
                {editingId === e.id ? (
                  <div className="space-y-3">
                    <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs">
                      <button
                        type="button"
                        className={`rounded-md px-2 py-1 ${
                          orderScope === "mine" ? "bg-[#0d5c63] text-white" : "text-slate-600"
                        }`}
                        onClick={() => setOrderScope("mine")}
                      >
                        Meine
                      </button>
                      <button
                        type="button"
                        className={`rounded-md px-2 py-1 ${
                          orderScope === "all" ? "bg-[#0d5c63] text-white" : "text-slate-600"
                        }`}
                        onClick={() => setOrderScope("all")}
                      >
                        Alle
                      </button>
                    </div>
                    {renderOrderSelect(
                      editForm.orderId,
                      (orderId) => setEditForm({ ...editForm, orderId }),
                      true
                    )}
                    {renderActivityFields(editForm, setEditForm, true)}
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
                      onChange={(ev) => setEditForm({ ...editForm, notes: ev.target.value })}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="action"
                        disabled={saving}
                        onClick={() => saveEdit(e.id)}
                      >
                        {saving ? "Speichern…" : "Speichern"}
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
                      {e.activity && (
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
                        onClick={() => setDeleteId(e.id)}
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

      <p className="text-[11px] text-slate-400">
        Arbeitskosten erscheinen im Auftrag, sobald beim Mitarbeiter ein Stundenlohn hinterlegt ist.
      </p>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Zeiteintrag löschen?"
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
