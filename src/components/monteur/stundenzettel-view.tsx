"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/utils";
import { fetchJson } from "@/lib/fetch-json";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { de } from "date-fns/locale";
import { Clock, Plus, Pencil, Trash2 } from "lucide-react";

interface TimeEntry {
  id: string;
  startTime: string;
  endTime: string | null;
  breakMinutes: number;
  notes: string | null;
  order: { id: string; orderNumber: string; customer: { firstName: string; lastName: string } };
}

interface OrderOption {
  id: string;
  orderNumber: string;
  customer: { lastName: string };
}

function toDatetimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function StundenzettelView({ title = "Stundenzettel" }: { title?: string }) {
  const [weekStart, setWeekStart] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    startTime: "",
    endTime: "",
    breakMinutes: "0",
    notes: "",
  });
  const [form, setForm] = useState({
    orderId: "",
    startTime: toDatetimeLocal(new Date()),
    endTime: "",
    breakMinutes: "0",
    notes: "",
  });

  function loadEntries() {
    const from = weekStart;
    const to = format(endOfWeek(new Date(weekStart), { weekStartsOn: 1 }), "yyyy-MM-dd");
    fetchJson<{ entries: TimeEntry[]; totalHours: number }>(`/api/monteur/timesheet?from=${from}&to=${to}`)
      .then((d) => {
        if (d.success && d.data) {
          setEntries(d.data.entries);
          setTotalHours(d.data.totalHours);
          setError("");
        } else {
          setError(d.error ?? "Zeiten konnten nicht geladen werden");
        }
      });
  }

  useEffect(() => { loadEntries(); }, [weekStart]);

  useEffect(() => {
    fetchJson<OrderOption[]>("/api/monteur/orders").then((d) => {
      if (d.success && d.data) setOrders(d.data);
    });
  }, []);

  function entryHours(e: TimeEntry) {
    if (!e.endTime) return "läuft";
    const ms = new Date(e.endTime).getTime() - new Date(e.startTime).getTime();
    const h = Math.max(0, ms / 3600000 - (e.breakMinutes ?? 0) / 60);
    return `${h.toFixed(2)} h`;
  }

  async function submitTime(e: React.FormEvent) {
    e.preventDefault();
    setFormMsg("");
    if (!form.orderId) {
      setFormMsg("Bitte einen Auftrag auswählen.");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/monteur/orders/${form.orderId}/time`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startTime: new Date(form.startTime).toISOString(),
        endTime: form.endTime ? new Date(form.endTime).toISOString() : undefined,
        breakMinutes: Number(form.breakMinutes) || 0,
        notes: form.notes.trim() || undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) {
      setForm({
        orderId: "",
        startTime: toDatetimeLocal(new Date()),
        endTime: "",
        breakMinutes: "0",
        notes: "",
      });
      setShowForm(false);
      setFormMsg("Zeit erfasst.");
      loadEntries();
    } else {
      setFormMsg(data.error ?? "Erfassung fehlgeschlagen");
    }
  }

  function startEdit(entry: TimeEntry) {
    setEditingId(entry.id);
    setEditForm({
      startTime: toDatetimeLocal(new Date(entry.startTime)),
      endTime: entry.endTime ? toDatetimeLocal(new Date(entry.endTime)) : "",
      breakMinutes: String(entry.breakMinutes ?? 0),
      notes: entry.notes ?? "",
    });
  }

  async function saveEdit(entryId: string) {
    setSaving(true);
    const res = await fetch(`/api/monteur/time/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startTime: new Date(editForm.startTime).toISOString(),
        endTime: editForm.endTime ? new Date(editForm.endTime).toISOString() : null,
        breakMinutes: Number(editForm.breakMinutes) || 0,
        notes: editForm.notes.trim() || null,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) {
      setEditingId(null);
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
        <p className="text-sm text-slate-500 mt-1">Arbeitszeiten erfassen und einsehen</p>
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
          <Button type="button" variant="action" size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4 mr-1" /> Zeit erfassen
          </Button>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Alternativ: Im Tagesplan bei einem Auftrag „Pause erfassen" oder Zeiten beim Abschluss.
        </p>
      </Card>

      {showForm && (
        <Card title="Neue Zeitbuchung">
          <form onSubmit={submitTime} className="space-y-3">
            <div>
              <label className="text-sm font-medium">Auftrag *</label>
              <select
                className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
                value={form.orderId}
                onChange={(e) => setForm({ ...form, orderId: e.target.value })}
                required
              >
                <option value="">— Auftrag wählen —</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber} · {o.customer?.lastName ?? ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Beginn *</label>
                <input
                  type="datetime-local"
                  className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Ende (optional)</label>
                <input
                  type="datetime-local"
                  className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                />
              </div>
            </div>
            <Input
              label="Pause (Minuten)"
              type="number"
              min={0}
              value={form.breakMinutes}
              onChange={(e) => setForm({ ...form, breakMinutes: e.target.value })}
            />
            <Textarea
              label="Notiz (optional)"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            {formMsg && (
              <p className={`text-sm ${formMsg.includes("erfasst") ? "text-green-700" : "text-red-600"}`}>
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

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <Card>
        {entries.length === 0 ? (
          <p className="text-center text-slate-500 py-8">Keine Zeiten in dieser Woche.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {entries.map((e) => (
              <div key={e.id} className="py-3">
                {editingId === e.id ? (
                  <div className="space-y-3">
                    <p className="font-medium text-sm">
                      {e.order.orderNumber} · {e.order.customer.lastName}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium">Beginn</label>
                        <input
                          type="datetime-local"
                          className="w-full mt-1 h-9 rounded-lg border border-slate-300 px-2 text-sm"
                          value={editForm.startTime}
                          onChange={(ev) => setEditForm({ ...editForm, startTime: ev.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium">Ende</label>
                        <input
                          type="datetime-local"
                          className="w-full mt-1 h-9 rounded-lg border border-slate-300 px-2 text-sm"
                          value={editForm.endTime}
                          onChange={(ev) => setEditForm({ ...editForm, endTime: ev.target.value })}
                        />
                      </div>
                    </div>
                    <Input
                      label="Pause (Minuten)"
                      type="number"
                      min={0}
                      value={editForm.breakMinutes}
                      onChange={(ev) => setEditForm({ ...editForm, breakMinutes: ev.target.value })}
                    />
                    <Textarea
                      label="Notiz"
                      rows={2}
                      value={editForm.notes}
                      onChange={(ev) => setEditForm({ ...editForm, notes: ev.target.value })}
                    />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="action" disabled={saving} onClick={() => saveEdit(e.id)}>
                        Speichern
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        Abbrechen
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">
                          {e.order.orderNumber} · {e.order.customer.lastName}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {formatDateTime(e.startTime)}
                          {e.endTime ? ` – ${formatDateTime(e.endTime)}` : " (offen)"}
                          {(e.breakMinutes ?? 0) > 0 && ` · ${e.breakMinutes} Min. Pause`}
                        </p>
                        {e.notes && <p className="text-xs text-slate-400 italic">{e.notes}</p>}
                        <p className="text-sm font-semibold text-[#0d5c63] mt-1">{entryHours(e)}</p>
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
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
