"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { AddressSuggestInput } from "@/components/ui/address-suggest-input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { APPOINTMENT_COLORS, appointmentDisplayTitle } from "@/lib/calendar/appointment-colors";
import { saveJson } from "@/lib/save-toast";
import type { CalendarAppointment } from "@/components/calendar/schedule-calendar";
import { ArrowLeft, ArrowRight, Clock, ExternalLink, Minus, Plus, Trash2 } from "lucide-react";

function toDateInput(d: Date) {
  return format(d, "yyyy-MM-dd");
}
function toTimeInput(d: Date) {
  return format(d, "HH:mm");
}
function combineLocal(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  return new Date(y, m - 1, d, h, min || 0, 0, 0);
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const safeMinutes = Math.min(23 * 60 + 45, Math.max(0, minutes));
  return `${String(Math.floor(safeMinutes / 60)).padStart(2, "0")}:${String(safeMinutes % 60).padStart(2, "0")}`;
}

type EmployeeOption = { id: string; user: { firstName: string; lastName: string } };
type TeamOption = { id: string; name: string };
type VehicleOption = { id: string; name: string };
type ProjectOption = { id: string; name: string };

interface CalendarEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: CalendarAppointment | null;
  employees: EmployeeOption[];
  teams: TeamOption[];
  vehicles: VehicleOption[];
  projects: ProjectOption[];
  canEdit: boolean;
  onSaved: (appointment?: CalendarAppointment) => void;
}

export function CalendarEditDialog({
  open,
  onOpenChange,
  appointment,
  employees,
  teams,
  vehicles,
  projects,
  canEdit,
  onSaved,
}: CalendarEditDialogProps) {
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dateStr, setDateStr] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [title, setTitle] = useState("");
  const [color, setColor] = useState("#0d5c63");
  const [employeeId, setEmployeeId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("GEPLANT");
  const [addressText, setAddressText] = useState("");

  useEffect(() => {
    if (!open || !appointment) return;
    const start = new Date(appointment.startTime);
    const end = new Date(appointment.endTime);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Ein neu geöffneter Termin initialisiert bewusst den Dialogentwurf.
    setDateStr(toDateInput(start));
    setStartTime(toTimeInput(start));
    setEndTime(toTimeInput(end));
    setTitle(appointment.title ?? appointment.order?.title ?? "");
    setColor(appointment.color ?? appointment.employee?.color ?? "#0d5c63");
    setEmployeeId(appointment.employeeId ?? "");
    setTeamId(appointment.teamId ?? appointment.order?.team?.id ?? "");
    setVehicleId(appointment.vehicleId ?? appointment.order?.vehicle?.id ?? "");
    setProjectId(
      appointment.projectId ??
        appointment.project?.id ??
        appointment.order?.project?.id ??
        ""
    );
    setNotes(appointment.notes ?? "");
    setStatus(appointment.status ?? "GEPLANT");
    setAddressText(appointment.addressText ?? "");
  }, [open, appointment]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!appointment || !canEdit || saving) return;
    const start = combineLocal(dateStr, startTime);
    const end = combineLocal(dateStr, endTime);
    if (end <= start) return;

    setSaving(true);
    const res = await saveJson<CalendarAppointment>(`/api/appointments/${appointment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        title: title.trim() || null,
        color: color || null,
        employeeId: employeeId || null,
        teamId: teamId || null,
        vehicleId: vehicleId || null,
        projectId: projectId || null,
        notes: notes.trim() || null,
        status,
        addressText: addressText.trim() || null,
      }),
    }, {
      loading: "Termin wird gespeichert …",
      success: "Termin aktualisiert",
    });
    setSaving(false);
    if (res.success) {
      onOpenChange(false);
      onSaved(res.data);
    }
  }

  async function handleDelete() {
    if (!appointment || !canEdit) return;
    setSaving(true);
    const res = await saveJson(`/api/appointments/${appointment.id}?hard=1`, {
      method: "DELETE",
    }, {
      loading: "Termin wird gelöscht …",
      success: "Termin gelöscht",
    });
    setSaving(false);
    setConfirmDelete(false);
    if (res.success) {
      onOpenChange(false);
      onSaved();
    }
  }

  if (!appointment) return null;

  const displayTitle = appointmentDisplayTitle({
    title: title || appointment.title,
    order: appointment.order,
  });
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const durationMinutes = endMinutes - startMinutes;
  const timeError = durationMinutes < 15 ? "Das Ende muss mindestens 15 Minuten nach dem Start liegen." : "";

  function changeStart(nextStart: string) {
    const nextStartMinutes = timeToMinutes(nextStart);
    const preservedDuration = Math.max(15, durationMinutes);
    setStartTime(nextStart);
    setEndTime(minutesToTime(nextStartMinutes + preservedDuration));
  }

  function changeDuration(minutes: number) {
    setEndTime(minutesToTime(startMinutes + minutes));
  }

  function shiftAppointment(minutes: number) {
    const nextStart = startMinutes + minutes;
    const nextEnd = endMinutes + minutes;
    if (nextStart < 0 || nextEnd > 23 * 60 + 45) return;
    setStartTime(minutesToTime(nextStart));
    setEndTime(minutesToTime(nextEnd));
  }

  const timesheetHref = (() => {
    const params = new URLSearchParams();
    if (appointment.order?.id) params.set("orderId", appointment.order.id);
    params.set("start", appointment.startTime);
    params.set("end", appointment.endTime);
    if (appointment.employeeId) params.set("employeeId", appointment.employeeId);
    return `/dashboard/stundenzettel?${params.toString()}`;
  })();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0">
          <form onSubmit={handleSave}>
            <DialogHeader className="p-4 pb-2">
              <DialogTitle>{displayTitle}</DialogTitle>
              <DialogDescription>
                Termin bearbeiten{canEdit ? "" : " (nur Ansicht)"}
              </DialogDescription>
            </DialogHeader>

            <div className="px-4 py-3 space-y-3 border-t border-slate-100">
              <div className="space-y-1.5">
                <Label htmlFor="edit-title">Titel</Label>
                <Input
                  id="edit-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={!canEdit}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Farbe</Label>
                <div className="flex flex-wrap gap-2">
                  {APPOINTMENT_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      title={c.label}
                      disabled={!canEdit}
                      onClick={() => setColor(c.hex)}
                      className={`h-8 w-8 rounded-full border-2 disabled:opacity-50 ${
                        color === c.hex ? "border-slate-900 scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>

              <section className="rounded-2xl border border-[#0d5c63]/15 bg-[#0d5c63]/[0.035] p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Clock className="h-4 w-4 text-[#0d5c63]" /> Einsatzzeit
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {durationMinutes >= 15
                        ? `${Math.floor(durationMinutes / 60)} Std. ${durationMinutes % 60 ? `${durationMinutes % 60} Min.` : ""}`
                        : "Bitte gültigen Zeitraum wählen"}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
                      <button
                        type="button"
                        onClick={() => shiftAppointment(-15)}
                        className="inline-flex h-8 items-center gap-1 rounded-[9px] px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                        aria-label="Termin 15 Minuten früher"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" /> 15
                      </button>
                      <button
                        type="button"
                        onClick={() => shiftAppointment(15)}
                        className="inline-flex h-8 items-center gap-1 rounded-[9px] px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                        aria-label="Termin 15 Minuten später"
                      >
                        15 <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.35fr_1fr_1fr]">
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="edit-date">Datum</Label>
                  <DateInput
                    id="edit-date"
                    type="date"
                    className="min-w-0 w-full"
                    value={dateStr}
                    onValueChange={setDateStr}
                    disabled={!canEdit}
                    required
                  />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="edit-start">Start</Label>
                  <DateInput
                    id="edit-start"
                    type="time"
                    step={900}
                    className="min-w-0 w-full"
                    value={startTime}
                    onValueChange={changeStart}
                    disabled={!canEdit}
                    required
                  />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="edit-end">Ende</Label>
                  <DateInput
                    id="edit-end"
                    type="time"
                    step={900}
                    className="min-w-0 w-full"
                    value={endTime}
                    onValueChange={setEndTime}
                    disabled={!canEdit}
                    required
                  />
                </div>
                </div>

                {canEdit && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Dauer
                    </span>
                    {[30, 60, 120, 240].map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        onClick={() => changeDuration(minutes)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                          durationMinutes === minutes
                            ? "border-[#0d5c63] bg-[#0d5c63] text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-600 hover:border-[#0d5c63]/30 hover:text-[#0d5c63]"
                        }`}
                      >
                        {minutes < 60 ? `${minutes} Min.` : `${minutes / 60} Std.`}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => changeDuration(Math.max(15, durationMinutes - 15))}
                      className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-[#0d5c63]"
                      aria-label="Dauer um 15 Minuten verkürzen"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => changeDuration(durationMinutes + 15)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-[#0d5c63]"
                      aria-label="Dauer um 15 Minuten verlängern"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {timeError && <p className="mt-2 text-xs font-medium text-rose-600">{timeError}</p>}
              </section>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Mitarbeiter</Label>
                  <select
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    disabled={!canEdit}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:opacity-50"
                  >
                    <option value="">Ohne Zuweisung</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.user.firstName} {emp.user.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Team</Label>
                  <select
                    value={teamId}
                    onChange={(e) => setTeamId(e.target.value)}
                    disabled={!canEdit}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:opacity-50"
                  >
                    <option value="">Kein Team</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Fahrzeug</Label>
                  <select
                    value={vehicleId}
                    onChange={(e) => setVehicleId(e.target.value)}
                    disabled={!canEdit}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:opacity-50"
                  >
                    <option value="">Kein Fahrzeug</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Projekt</Label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    disabled={!canEdit}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:opacity-50"
                  >
                    <option value="">Kein Projekt</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={!canEdit}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:opacity-50"
                >
                  <option value="GEPLANT">Geplant</option>
                  <option value="UNTERWEGS">Unterwegs</option>
                  <option value="ANGEKOMMEN">Angekommen</option>
                  <option value="IN_ARBEIT">In Arbeit</option>
                  <option value="ABGESCHLOSSEN">Abgeschlossen</option>
                </select>
              </div>

              <AddressSuggestInput
                label="Adresse"
                value={addressText}
                onChange={setAddressText}
                disabled={!canEdit}
                placeholder="Optional – Straße, PLZ Ort…"
              />

              <div className="space-y-1.5">
                <Label>Notiz</Label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={!canEdit}
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm resize-y min-h-[64px] disabled:opacity-50"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {appointment.order?.id && (
                  <Button asChild variant="outline" size="sm" type="button">
                    <Link href={`/dashboard/auftraege/${appointment.order.id}`}>
                      <ExternalLink className="h-4 w-4 mr-1" /> Auftrag
                    </Link>
                  </Button>
                )}
                {(appointment.project?.id || appointment.order?.project?.id) && (
                  <Button asChild variant="outline" size="sm" type="button">
                    <Link
                      href={`/dashboard/projekte/${
                        appointment.project?.id ?? appointment.order?.project?.id
                      }`}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" /> Projekt
                    </Link>
                  </Button>
                )}
                <Button asChild variant="outline" size="sm" type="button">
                  <Link href={timesheetHref}>
                    <Clock className="h-4 w-4 mr-1" /> Zeit buchen
                  </Link>
                </Button>
              </div>
            </div>

            <DialogFooter className="mx-0 mb-0 rounded-b-xl flex-wrap gap-2">
              {canEdit && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-rose-700 border-rose-200 mr-auto"
                  onClick={() => setConfirmDelete(true)}
                  disabled={saving}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Löschen
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Schließen
              </Button>
              {canEdit && (
                <Button type="submit" disabled={saving || Boolean(timeError)}>
                  {saving ? "Speichern…" : "Speichern"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Termin löschen?"
        description="Dieser Termin wird unwiderruflich entfernt. Zugehörige Aufträge bleiben erhalten."
        confirmLabel="Termin löschen"
        cancelLabel="Abbrechen"
        variant="destructive"
        loading={saving}
        onConfirm={handleDelete}
      />
    </>
  );
}
