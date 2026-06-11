"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ScheduleCalendar, type CalendarAppointment } from "@/components/calendar/schedule-calendar";
import { addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { formatDateTime } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { usePermission, useSession } from "@/components/auth/can-access";

export function TeamCalendarView({ title = "Terminplanung" }: { title?: string }) {
  const canEdit = usePermission("appointments.write");
  const session = useSession();
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [view, setView] = useState<"week" | "month">("week");
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [employees, setEmployees] = useState<{ id: string; user: { id?: string; firstName: string; lastName: string }; color: string }[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [vehicles, setVehicles] = useState<{ id: string; name: string }[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [showList, setShowList] = useState(false);

  const loadAppointments = useCallback(() => {
    let from: Date;
    let to: Date;
    if (view === "week") {
      from = startOfWeek(anchorDate, { weekStartsOn: 1 });
      to = addDays(from, 7);
    } else {
      from = startOfWeek(startOfMonth(anchorDate), { weekStartsOn: 1 });
      to = endOfWeek(endOfMonth(anchorDate), { weekStartsOn: 1 });
    }
    fetch(`/api/appointments?from=${from.toISOString()}&to=${to.toISOString()}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setAppointments(d.data); });
  }, [anchorDate, view]);

  useEffect(() => {
    fetch("/api/employees").then((r) => r.json()).then((d) => {
      if (!d.success) return;
      setEmployees(d.data);
      setSelectedEmployeeIds((prev) => {
        if (prev.length) return prev;
        // Zuerst nur den eigenen Kalender anzeigen, falls ein eigener
        // Mitarbeiter-Datensatz existiert – sonst alle.
        const own = d.data.find((e: { user: { id?: string } }) => e.user?.id === session.id);
        return own ? [own.id] : d.data.map((e: { id: string }) => e.id);
      });
    });
    fetch("/api/teams").then((r) => r.json()).then((d) => {
      if (d.success) setTeams(d.data.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
    });
    fetch("/api/vehicles").then((r) => r.json()).then((d) => {
      if (d.success) setVehicles(d.data.map((v: { id: string; name: string }) => ({ id: v.id, name: v.name })));
    });
  }, [session.id]);

  useEffect(() => { loadAppointments(); }, [loadAppointments]);

  async function reschedule(
    appointmentId: string,
    startTime: Date,
    endTime: Date,
    employeeId: string
  ) {
    if (!canEdit) return;
    await fetch(`/api/appointments/${appointmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        employeeId,
      }),
    });
    loadAppointments();
  }

  const teamFilterActive = selectedTeamIds.length > 0;
  const vehicleFilterActive = selectedVehicleIds.length > 0;
  const filtered = appointments.filter((a) => {
    if (a.employeeId && !selectedEmployeeIds.includes(a.employeeId)) return false;
    if (teamFilterActive && !(a.order.team && selectedTeamIds.includes(a.order.team.id))) return false;
    if (vehicleFilterActive && !(a.order.vehicle && selectedVehicleIds.includes(a.order.vehicle.id))) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] min-h-0 -mx-2 sm:-mx-0">
      <div className="shrink-0 mb-4 px-2 sm:px-0">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Team-Kalender – alle Mitarbeiter{canEdit ? "" : " (nur Ansicht)"}
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
          readOnly={!canEdit}
          teams={teams}
          selectedTeamIds={selectedTeamIds}
          onSelectedTeamIdsChange={setSelectedTeamIds}
          vehicles={vehicles}
          selectedVehicleIds={selectedVehicleIds}
          onSelectedVehicleIdsChange={setSelectedVehicleIds}
        />
      </div>

      <div className="shrink-0 mt-4 px-2 sm:px-0">
        <button
          type="button"
          onClick={() => setShowList(!showList)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-[#0d5c63]"
        >
          {showList ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Terminliste ({filtered.length})
        </button>
        {showList && (
          <div className="mt-2 rounded-xl border border-slate-200 bg-white divide-y divide-slate-50 max-h-48 overflow-y-auto">
            {filtered.map((apt) => (
              <Link
                key={apt.id}
                href={`/dashboard/auftraege/${apt.order.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: apt.employee?.color ?? "#0d5c63" }}
                />
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {formatDateTime(apt.startTime)} – {apt.order.customer.lastName}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {apt.order.orderNumber}
                    {apt.employee && ` · ${apt.employee.user.firstName} ${apt.employee.user.lastName}`}
                  </p>
                </div>
              </Link>
            ))}
            {!filtered.length && (
              <p className="text-sm text-slate-500 py-6 text-center">Keine Termine im gewählten Zeitraum.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
