"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ScheduleCalendar,
  type CalendarAppointment,
  type CalendarViewMode,
} from "@/components/calendar/schedule-calendar";
import {
  CalendarCreateDialog,
  type CalendarSlotSelection,
} from "@/components/calendar/calendar-create-dialog";
import { CalendarEditDialog } from "@/components/calendar/calendar-edit-dialog";
import { addDays, startOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { formatDateTime } from "@/lib/utils";
import { appointmentDisplayTitle } from "@/lib/calendar/appointment-colors";
import { ChevronDown, ChevronUp } from "lucide-react";
import { usePermission, useSession } from "@/components/auth/can-access";
import { toast } from "sonner";

export function TeamCalendarView({ title = "Termine" }: { title?: string }) {
  const canEdit = usePermission("appointments.write");
  const session = useSession();
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewMode>(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1024px)").matches) {
      return "day";
    }
    return "week";
  });
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [employees, setEmployees] = useState<
    { id: string; user: { id?: string; firstName: string; lastName: string }; color: string }[]
  >([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [vehicles, setVehicles] = useState<{ id: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [showList, setShowList] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSlot, setCreateSlot] = useState<CalendarSlotSelection | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editApt, setEditApt] = useState<CalendarAppointment | null>(null);

  const loadAppointments = useCallback(() => {
    let from: Date;
    let to: Date;
    if (view === "day") {
      from = startOfDay(anchorDate);
      to = addDays(from, 1);
    } else if (view === "month") {
      from = startOfWeek(startOfMonth(anchorDate), { weekStartsOn: 1 });
      to = endOfWeek(endOfMonth(anchorDate), { weekStartsOn: 1 });
    } else {
      from = startOfWeek(anchorDate, { weekStartsOn: 1 });
      to = addDays(from, 7);
    }
    fetch(`/api/appointments?from=${from.toISOString()}&to=${to.toISOString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setAppointments(d.data);
        } else {
          toast.error(d.error ?? "Termine konnten nicht geladen werden");
        }
      })
      .catch(() => toast.error("Termine konnten nicht geladen werden"));
  }, [anchorDate, view]);

  useEffect(() => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        setEmployees(d.data);
        setSelectedEmployeeIds((prev) => {
          if (prev.length) return prev;
          const own = d.data.find(
            (e: { user: { id?: string } }) => e.user?.id === session.id
          );
          return own ? [own.id] : d.data.map((e: { id: string }) => e.id);
        });
      });
    fetch("/api/teams")
      .then((r) => r.json())
      .then((d) => {
        if (d.success)
          setTeams(d.data.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
      });
    fetch("/api/vehicles")
      .then((r) => r.json())
      .then((d) => {
        if (d.success)
          setVehicles(
            d.data.map((v: { id: string; name: string }) => ({ id: v.id, name: v.name }))
          );
      });
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        setProjects(
          (d.data as { id: string; name: string }[]).map((p) => ({
            id: p.id,
            name: p.name,
          }))
        );
      });
  }, [session.id]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  async function reschedule(
    appointmentId: string,
    startTime: Date,
    endTime: Date,
    employeeId: string
  ) {
    if (!canEdit) return;
    const toastId = toast.loading("Termin wird verschoben …");
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          employeeId,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error ?? "Verschieben fehlgeschlagen", { id: toastId });
        return;
      }
      toast.success("Termin verschoben", { id: toastId });
      loadAppointments();
    } catch {
      toast.error("Verschieben fehlgeschlagen", { id: toastId });
    }
  }

  function handleSlotSelect(slot: CalendarSlotSelection) {
    if (!canEdit) return;
    setCreateSlot(slot);
    setCreateOpen(true);
  }

  function handleAppointmentClick(apt: CalendarAppointment) {
    setEditApt(apt);
    setEditOpen(true);
  }

  const teamFilterActive = selectedTeamIds.length > 0;
  const vehicleFilterActive = selectedVehicleIds.length > 0;
  const filtered = appointments.filter((a) => {
    if (a.employeeId && !selectedEmployeeIds.includes(a.employeeId)) return false;
    const teamId = a.teamId ?? a.team?.id ?? a.order?.team?.id;
    const vehicleId = a.vehicleId ?? a.vehicle?.id ?? a.order?.vehicle?.id;
    if (teamFilterActive && !(teamId && selectedTeamIds.includes(teamId))) return false;
    if (vehicleFilterActive && !(vehicleId && selectedVehicleIds.includes(vehicleId))) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] min-h-0 -mx-2 sm:-mx-0">
      <div className="shrink-0 mb-4 px-2 sm:px-0">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Moderner Team-Kalender{canEdit ? "" : " (nur Ansicht)"}
          {canEdit ? " · Tippen/Klicken für neuen Termin" : ""}
        </p>
      </div>

      <div className="flex-1 min-h-0 px-2 sm:px-0">
        <ScheduleCalendar
          view={view}
          anchorDate={anchorDate}
          appointments={appointments}
          employees={employees}
          selectedEmployeeIds={selectedEmployeeIds}
          onSelectedEmployeeIdsChange={setSelectedEmployeeIds}
          onAnchorChange={setAnchorDate}
          onViewChange={setView}
          onAppointmentReschedule={reschedule}
          onSlotSelect={canEdit ? handleSlotSelect : undefined}
          onAppointmentClick={handleAppointmentClick}
          readOnly={!canEdit}
          teams={teams}
          selectedTeamIds={selectedTeamIds}
          onSelectedTeamIdsChange={setSelectedTeamIds}
          vehicles={vehicles}
          selectedVehicleIds={selectedVehicleIds}
          onSelectedVehicleIdsChange={setSelectedVehicleIds}
        />
      </div>

      <CalendarCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        slot={createSlot}
        employees={employees}
        teams={teams}
        vehicles={vehicles}
        onCreated={loadAppointments}
      />

      <CalendarEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        appointment={editApt}
        employees={employees}
        teams={teams}
        vehicles={vehicles}
        projects={projects}
        canEdit={canEdit}
        onSaved={loadAppointments}
      />

      <div className="shrink-0 mt-3 px-2 sm:px-0">
        <button
          type="button"
          onClick={() => setShowList((v) => !v)}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          {showList ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Termine als Liste ({filtered.length})
        </button>
        {showList && (
          <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-50">
            {filtered.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => handleAppointmentClick(a)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
              >
                <span className="font-medium text-slate-800">
                  {appointmentDisplayTitle({ title: a.title, order: a.order })}
                </span>
                <span className="block text-xs text-slate-500">
                  {formatDateTime(a.startTime)}
                  {a.employee
                    ? ` · ${a.employee.user.firstName} ${a.employee.user.lastName}`
                    : ""}
                  {a.order ? (
                    <>
                      {" · "}
                      <Link
                        href={`/dashboard/auftraege/${a.order.id}`}
                        className="text-[#0d5c63] hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {a.order.orderNumber}
                      </Link>
                    </>
                  ) : null}
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-slate-400">Keine Termine</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
