"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  setHours,
  setMinutes,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Users, Truck, X, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CalendarFilterTeam {
  id: string;
  name: string;
}
export interface CalendarFilterVehicle {
  id: string;
  name: string;
}

export interface CalendarAppointment {
  id: string;
  startTime: string;
  endTime: string;
  employeeId: string | null;
  order: {
    id: string;
    orderNumber: string;
    customer: { firstName: string; lastName: string };
    team?: { id: string; name: string } | null;
    vehicle?: { id: string; name: string; licensePlate: string | null } | null;
  };
  employee: { color: string; user: { firstName: string; lastName: string } } | null;
}

interface ScheduleCalendarProps {
  view: "week" | "month";
  anchorDate: Date;
  appointments: CalendarAppointment[];
  employees: { id: string; user: { firstName: string; lastName: string }; color: string }[];
  selectedEmployeeIds: string[];
  onSelectedEmployeeIdsChange: (ids: string[]) => void;
  onAnchorChange: (date: Date) => void;
  onViewChange: (view: "week" | "month") => void;
  onAppointmentReschedule: (
    appointmentId: string,
    startTime: Date,
    endTime: Date,
    employeeId: string
  ) => Promise<void>;
  readOnly?: boolean;
  /** Optionale Filter nach Teams. Leere Auswahl = alle anzeigen. */
  teams?: CalendarFilterTeam[];
  selectedTeamIds?: string[];
  onSelectedTeamIdsChange?: (ids: string[]) => void;
  /** Optionale Filter nach Fahrzeugen. Leere Auswahl = alle anzeigen. */
  vehicles?: CalendarFilterVehicle[];
  selectedVehicleIds?: string[];
  onSelectedVehicleIdsChange?: (ids: string[]) => void;
}

const HOUR_START = 7;
const HOUR_END = 20;
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

/** Besonders wichtiger Zeitraum, der im Kalender hervorgehoben wird. */
const FOCUS_START = 17;
const FOCUS_END = 19;

const FULL_DAY_THRESHOLD_MINUTES = 8 * 60;

/** Reagiert auf eine CSS-Media-Query (clientseitig). */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = () => setMatches(mql.matches);
    handler();
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

function isAllDayLike(start: Date, end: Date): boolean {
  if (!isSameDay(start, end)) return true;
  const minutes = (end.getTime() - start.getTime()) / 60000;
  return minutes >= FULL_DAY_THRESHOLD_MINUTES;
}

function weekSpan(apt: CalendarAppointment, weekDays: Date[]) {
  const start = new Date(apt.startTime);
  const end = new Date(apt.endTime);
  const last = weekDays.length - 1;
  let startCol = weekDays.findIndex((d) => isSameDay(d, start));
  let endCol = weekDays.findIndex((d) => isSameDay(d, end));
  if (startCol === -1) startCol = start.getTime() < weekDays[0].getTime() ? 0 : -1;
  if (endCol === -1) endCol = end.getTime() > weekDays[last].getTime() ? last : -1;
  if (startCol === -1 || endCol === -1) return null;
  return { startCol, endCol, span: endCol - startCol + 1 };
}

function layoutAllDayLanes(
  bars: { apt: CalendarAppointment; startCol: number; endCol: number; span: number }[]
) {
  const sorted = [...bars].sort((a, b) => a.startCol - b.startCol || b.span - a.span);
  const lanes: { endCol: number }[][] = [];
  const placed: {
    apt: CalendarAppointment;
    startCol: number;
    endCol: number;
    span: number;
    lane: number;
  }[] = [];

  for (const bar of sorted) {
    let lane = lanes.findIndex((laneBars) => !laneBars.some((b) => bar.startCol <= b.endCol));
    if (lane === -1) {
      lane = lanes.length;
      lanes.push([]);
    }
    lanes[lane].push({ endCol: bar.endCol });
    placed.push({ ...bar, lane });
  }
  return { placed, laneCount: Math.max(lanes.length, 1) };
}

function aptStyle(start: Date, end: Date, hourHeight: number) {
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const gridStart = HOUR_START * 60;
  const top = ((startMinutes - gridStart) / 60) * hourHeight;
  const height = Math.max(((endMinutes - startMinutes) / 60) * hourHeight, 22);
  return { top, height };
}

function dropTimeFromY(clientY: number, rectTop: number, hourHeight: number): { hour: number; minute: number } {
  const y = Math.max(0, clientY - rectTop);
  const totalMinutes = (y / hourHeight) * 60 + HOUR_START * 60;
  const hour = Math.min(HOUR_END, Math.max(HOUR_START, Math.floor(totalMinutes / 60)));
  const minute = Math.round((totalMinutes % 60) / 15) * 15;
  return { hour, minute: minute >= 60 ? 0 : minute };
}

function getEmployeeColor(
  apt: CalendarAppointment,
  employees: { id: string; color: string }[]
): string {
  if (apt.employee?.color) return apt.employee.color;
  if (apt.employeeId) {
    const emp = employees.find((e) => e.id === apt.employeeId);
    if (emp) return emp.color;
  }
  return "#0d5c63";
}

function layoutOverlapping(apts: CalendarAppointment[]) {
  const sorted = [...apts].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
  const columns: CalendarAppointment[][] = [];

  for (const apt of sorted) {
    const start = new Date(apt.startTime).getTime();
    let placed = false;
    for (const col of columns) {
      const last = col[col.length - 1];
      if (new Date(last.endTime).getTime() <= start) {
        col.push(apt);
        placed = true;
        break;
      }
    }
    if (!placed) columns.push([apt]);
  }

  const totalCols = Math.max(columns.length, 1);
  const laid: { apt: CalendarAppointment; col: number; totalCols: number }[] = [];
  columns.forEach((col, colIdx) => {
    col.forEach((apt) => laid.push({ apt, col: colIdx, totalCols }));
  });
  return laid;
}

export function ScheduleCalendar({
  view,
  anchorDate,
  appointments,
  employees,
  selectedEmployeeIds,
  onSelectedEmployeeIdsChange,
  onAnchorChange,
  onViewChange,
  onAppointmentReschedule,
  readOnly = false,
  teams = [],
  selectedTeamIds = [],
  onSelectedTeamIdsChange,
  vehicles = [],
  selectedVehicleIds = [],
  onSelectedVehicleIdsChange,
}: ScheduleCalendarProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Auf Mobile/Tablet kompakte Arbeitswoche (Mo–Fr), sonst volle Woche (Mo–So).
  const isCompact = useMediaQuery("(max-width: 1024px)");
  const dayCount = isCompact ? 5 : 7;
  const hourHeight = isCompact ? 34 : 48;
  const timeColW = isCompact ? 40 : 64;
  const gridHeight = HOURS.length * hourHeight;
  const gridTemplate = `${timeColW}px repeat(${dayCount}, minmax(0, 1fr))`;

  const weekStart = startOfWeek(anchorDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: dayCount }, (_, i) => addDays(weekStart, i));
  const monthStart = startOfMonth(anchorDate);
  const monthGridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const monthGridEnd = endOfWeek(endOfMonth(anchorDate), { weekStartsOn: 1 });
  const monthDays = eachDayOfInterval({ start: monthGridStart, end: monthGridEnd });

  const teamFilterActive = teams.length > 0 && selectedTeamIds.length > 0;
  const vehicleFilterActive = vehicles.length > 0 && selectedVehicleIds.length > 0;
  const showFilters = (teams.length > 0 && !!onSelectedTeamIdsChange) || (vehicles.length > 0 && !!onSelectedVehicleIdsChange);

  function navigate(dir: -1 | 1) {
    if (view === "week") onAnchorChange(addWeeks(anchorDate, dir));
    else onAnchorChange(addMonths(anchorDate, dir));
  }

  function toggleEmployee(id: string) {
    if (selectedEmployeeIds.includes(id)) {
      if (selectedEmployeeIds.length > 1) {
        onSelectedEmployeeIdsChange(selectedEmployeeIds.filter((x) => x !== id));
      }
    } else {
      onSelectedEmployeeIdsChange([...selectedEmployeeIds, id]);
    }
  }

  function toggleId(list: string[], id: string, setter?: (ids: string[]) => void) {
    if (!setter) return;
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  function isVisible(a: CalendarAppointment) {
    if (a.employeeId && !selectedEmployeeIds.includes(a.employeeId)) return false;
    if (teamFilterActive && !(a.order.team && selectedTeamIds.includes(a.order.team.id))) return false;
    if (vehicleFilterActive && !(a.order.vehicle && selectedVehicleIds.includes(a.order.vehicle.id))) return false;
    return true;
  }

  function aptsForDay(day: Date) {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    return appointments.filter((a) => {
      const start = new Date(a.startTime);
      const end = new Date(a.endTime);
      return start <= dayEnd && end >= dayStart && isVisible(a);
    });
  }

  function timedAptsForDay(day: Date) {
    return appointments.filter((a) => {
      const start = new Date(a.startTime);
      const end = new Date(a.endTime);
      return isSameDay(start, day) && !isAllDayLike(start, end) && isVisible(a);
    });
  }

  const allDayBars = appointments
    .filter((a) => isVisible(a) && isAllDayLike(new Date(a.startTime), new Date(a.endTime)))
    .map((apt) => {
      const span = weekSpan(apt, weekDays);
      return span ? { apt, ...span } : null;
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);

  const { placed: allDayPlaced, laneCount: allDayLaneCount } = layoutAllDayLanes(allDayBars);

  async function handleDrop(e: React.DragEvent, day: Date, cellRef: HTMLDivElement | null) {
    if (readOnly) return;
    e.preventDefault();
    const aptId = e.dataTransfer.getData("appointmentId");
    if (!aptId || !cellRef) return;

    const apt = appointments.find((a) => a.id === aptId);
    if (!apt) return;

    const rect = cellRef.getBoundingClientRect();
    const { hour, minute } = dropTimeFromY(e.clientY, rect.top, hourHeight);
    const oldStart = new Date(apt.startTime);
    const oldEnd = new Date(apt.endTime);
    const durationMs = oldEnd.getTime() - oldStart.getTime();

    const newStart = setMinutes(setHours(day, hour), minute);
    const newEnd = new Date(newStart.getTime() + durationMs);
    const employeeId = apt.employeeId ?? selectedEmployeeIds[0] ?? "";

    setDraggingId(null);
    if (employeeId) {
      await onAppointmentReschedule(aptId, newStart, newEnd, employeeId);
    }
  }

  const headerLabel =
    view === "week"
      ? `${format(weekStart, "d. MMM", { locale: de })} – ${format(addDays(weekStart, dayCount - 1), "d. MMM yyyy", { locale: de })}`
      : format(anchorDate, "MMMM yyyy", { locale: de });

  const visibleCount = selectedEmployeeIds.length;

  const filterPanel = (
    <>
      <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Users className="h-4 w-4" /> Mitarbeiter
          </p>
          <p className="text-xs text-slate-400 mt-1">{visibleCount} von {employees.length} angezeigt</p>
        </div>
        <button type="button" className="lg:hidden text-slate-400 hover:text-slate-600" onClick={() => setMobileFilterOpen(false)}>
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {employees.map((emp) => {
          const active = selectedEmployeeIds.includes(emp.id);
          return (
            <button
              key={emp.id}
              type="button"
              onClick={() => toggleEmployee(emp.id)}
              className={`w-full flex items-center gap-2.5 py-2 px-3 rounded-lg text-left text-sm transition-colors ${
                active ? "bg-white shadow-sm ring-1 ring-slate-200" : "opacity-50 hover:opacity-80 hover:bg-white/60"
              }`}
            >
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0 ring-2 ring-white shadow-sm"
                style={{ backgroundColor: emp.color }}
              />
              <span className="truncate font-medium text-slate-800">
                {emp.user.firstName} {emp.user.lastName}
              </span>
            </button>
          );
        })}

        {showFilters && teams.length > 0 && onSelectedTeamIdsChange && (
          <div className="pt-3 mt-2 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 px-1 mb-2">
              <Users className="h-3.5 w-3.5" /> Teams
            </p>
            <div className="flex flex-wrap gap-1.5 px-1">
              {teams.map((t) => {
                const active = selectedTeamIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleId(selectedTeamIds, t.id, onSelectedTeamIdsChange)}
                    className={`px-2.5 py-1 rounded-full text-xs border ${active ? "bg-[#0d5c63] text-white border-[#0d5c63]" : "bg-white text-slate-600 border-slate-200"}`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {showFilters && vehicles.length > 0 && onSelectedVehicleIdsChange && (
          <div className="pt-3 mt-2 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 px-1 mb-2">
              <Truck className="h-3.5 w-3.5" /> Fahrzeuge
            </p>
            <div className="flex flex-wrap gap-1.5 px-1">
              {vehicles.map((v) => {
                const active = selectedVehicleIds.includes(v.id);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => toggleId(selectedVehicleIds, v.id, onSelectedVehicleIdsChange)}
                    className={`px-2.5 py-1 rounded-full text-xs border ${active ? "bg-slate-700 text-white border-slate-700" : "bg-white text-slate-600 border-slate-200"}`}
                  >
                    {v.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="p-3 border-t border-slate-200 space-y-2">
        <button
          type="button"
          className="w-full text-xs text-[#0d5c63] hover:underline font-medium"
          onClick={() => onSelectedEmployeeIdsChange(employees.map((e) => e.id))}
        >
          Alle Mitarbeiter anzeigen
        </button>
        {(teamFilterActive || vehicleFilterActive) && (
          <button
            type="button"
            className="w-full text-xs text-slate-500 hover:underline"
            onClick={() => {
              onSelectedTeamIdsChange?.([]);
              onSelectedVehicleIdsChange?.([]);
            }}
          >
            Team-/Fahrzeugfilter zurücksetzen
          </button>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-full min-h-0 gap-0 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm relative">
      {mobileFilterOpen && (
        <button
          type="button"
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          aria-label="Filter schließen"
          onClick={() => setMobileFilterOpen(false)}
        />
      )}

      <aside className="hidden lg:flex w-56 shrink-0 border-r border-slate-200 bg-slate-50 flex-col sticky top-0 self-start h-full max-h-full overflow-hidden">
        {filterPanel}
      </aside>

      <aside
        className={`lg:hidden fixed inset-y-0 left-0 w-72 z-50 border-r border-slate-200 bg-slate-50 flex flex-col shadow-xl transition-transform ${
          mobileFilterOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {filterPanel}
      </aside>

      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 sm:px-4 py-2.5 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm sm:text-base font-semibold min-w-[140px] sm:min-w-[220px] text-center capitalize">{headerLabel}</span>
            <Button variant="outline" size="sm" onClick={() => navigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => onAnchorChange(new Date())}>Heute</Button>
          </div>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden px-3 py-2 text-sm font-medium bg-white text-slate-600 border-r border-slate-200 flex items-center gap-1"
            >
              <SlidersHorizontal className="h-4 w-4" /> {visibleCount}
            </button>
            <button
              type="button"
              onClick={() => onViewChange("week")}
              className={`px-3 sm:px-4 py-2 text-sm font-medium ${view === "week" ? "bg-[#0d5c63] text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              Woche
            </button>
            <button
              type="button"
              onClick={() => onViewChange("month")}
              className={`px-3 sm:px-4 py-2 text-sm font-medium ${view === "month" ? "bg-[#0d5c63] text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              Monat
            </button>
          </div>
        </div>

        {view === "week" ? (
          <div className="flex-1 overflow-auto">
            <div className={isCompact ? "min-w-0" : "min-w-[800px]"}>
              {/* Kopfzeile: Wochentage */}
              <div className="grid border-b border-slate-100 bg-slate-50 sticky top-0 z-20" style={{ gridTemplateColumns: gridTemplate }}>
                <div className="border-r border-slate-100" />
                {weekDays.map((day) => (
                  <div
                    key={day.toISOString()}
                    className={`py-2 text-center border-l border-slate-100 ${isSameDay(day, new Date()) ? "bg-[#0d5c63]/8" : ""}`}
                  >
                    <p className="text-[10px] sm:text-xs text-slate-500 uppercase font-medium">{format(day, "EEE", { locale: de })}</p>
                    <p className={`text-base sm:text-xl font-bold mt-0.5 ${isSameDay(day, new Date()) ? "text-[#0d5c63]" : "text-slate-800"}`}>
                      {format(day, "d.")}
                    </p>
                  </div>
                ))}
              </div>

              {/* Ganztägige / mehrtägige Termine */}
              {allDayPlaced.length > 0 && (
                <div className="grid border-b border-slate-200 bg-slate-50/60" style={{ gridTemplateColumns: gridTemplate }}>
                  <div className="border-r border-slate-100 flex items-start justify-end pr-1.5 pt-1.5">
                    <span className="text-[9px] sm:text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                      Ganztägig
                    </span>
                  </div>
                  <div className="relative" style={{ gridColumn: `span ${dayCount}`, height: allDayLaneCount * 22 + 8 }}>
                    {weekDays.map((day, i) => (
                      <div
                        key={day.toISOString()}
                        className="absolute top-0 bottom-0 border-l border-slate-100"
                        style={{ left: `${(i / dayCount) * 100}%` }}
                      />
                    ))}
                    {allDayPlaced.map(({ apt, startCol, span, lane }) => {
                      const color = getEmployeeColor(apt, employees);
                      const empName = apt.employee?.user
                        ? `${apt.employee.user.firstName.charAt(0)}. ${apt.employee.user.lastName}`
                        : "";
                      return (
                        <Link
                          key={apt.id}
                          href={`/dashboard/auftraege/${apt.order.id}`}
                          title={`${empName} · ${apt.order.orderNumber} (mehrtägig)`}
                          className="absolute flex items-center gap-1 rounded-md px-2 h-[18px] text-[11px] font-medium leading-[18px] text-white truncate shadow-sm border border-white/20 hover:opacity-90"
                          style={{
                            left: `calc(${(startCol / dayCount) * 100}% + 3px)`,
                            width: `calc(${(span / dayCount) * 100}% - 6px)`,
                            top: lane * 22 + 4,
                            backgroundColor: color,
                          }}
                        >
                          <span className="truncate">
                            {apt.order.customer.lastName}
                            {empName ? ` · ${empName}` : ""}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Stundenraster */}
              <div className="grid" style={{ gridTemplateColumns: gridTemplate }}>
                {/* Stundenachse links */}
                <div className="relative border-r border-slate-100 bg-slate-50/50" style={{ height: gridHeight }}>
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className={`absolute w-full text-[10px] sm:text-xs text-right pr-1 sm:pr-2 -translate-y-2 font-medium ${
                        h >= FOCUS_START && h < FOCUS_END ? "text-[#0d5c63] font-bold" : "text-slate-400"
                      }`}
                      style={{ top: (h - HOUR_START) * hourHeight }}
                    >
                      {String(h).padStart(2, "0")}{isCompact ? "" : ":00"}
                    </div>
                  ))}
                </div>

                {/* Tages-Spalten */}
                {weekDays.map((day) => (
                  <DayDropCell key={day.toISOString()} gridHeight={gridHeight} onDrop={(e, ref) => handleDrop(e, day, ref)}>
                    {/* Hervorgehobener Fokus-Zeitraum 17–19 Uhr */}
                    <div
                      className="absolute w-full bg-amber-100/50 border-y border-amber-200/70 pointer-events-none"
                      style={{ top: (FOCUS_START - HOUR_START) * hourHeight, height: (FOCUS_END - FOCUS_START) * hourHeight }}
                    />
                    {HOURS.map((h) => (
                      <div
                        key={h}
                        className="absolute w-full border-t border-slate-100"
                        style={{ top: (h - HOUR_START) * hourHeight, height: hourHeight }}
                      />
                    ))}

                    {layoutOverlapping(timedAptsForDay(day)).map(({ apt, col, totalCols }) => {
                      const start = new Date(apt.startTime);
                      const end = new Date(apt.endTime);
                      if (start.getHours() >= HOUR_END || end.getHours() < HOUR_START) return null;

                      const { top, height } = aptStyle(start, end, hourHeight);
                      const color = getEmployeeColor(apt, employees);
                      const widthPct = 100 / totalCols;
                      const leftPct = col * widthPct;
                      const empName = apt.employee?.user
                        ? `${apt.employee.user.firstName.charAt(0)}. ${apt.employee.user.lastName}`
                        : "";

                      return (
                        <div
                          key={apt.id}
                          draggable={!readOnly}
                          onDragStart={readOnly ? undefined : (e) => {
                            e.dataTransfer.setData("appointmentId", apt.id);
                            setDraggingId(apt.id);
                          }}
                          onDragEnd={readOnly ? undefined : () => setDraggingId(null)}
                          title={`${empName} · ${apt.order.orderNumber}`}
                          className={`absolute rounded-md px-1 sm:px-1.5 py-0.5 text-white overflow-hidden z-10 shadow-md border border-white/20 ${readOnly ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"} ${draggingId === apt.id ? "opacity-40 ring-2 ring-[#0d5c63]" : ""}`}
                          style={{
                            top,
                            height,
                            left: `calc(${leftPct}% + 2px)`,
                            width: `calc(${widthPct}% - 4px)`,
                            backgroundColor: color,
                          }}
                        >
                          <Link
                            href={`/dashboard/auftraege/${apt.order.id}`}
                            className="block h-full min-h-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <p className="text-[10px] sm:text-[11px] font-bold leading-tight truncate pointer-events-none">
                              {format(start, "HH:mm")} {apt.order.customer.lastName}
                            </p>
                            {height > 34 && empName && (
                              <p className="text-[9px] sm:text-[10px] opacity-90 truncate pointer-events-none">{empName}</p>
                            )}
                            {height > 50 && (
                              <p className="text-[9px] sm:text-[10px] opacity-75 truncate pointer-events-none">{apt.order.orderNumber}</p>
                            )}
                          </Link>
                        </div>
                      );
                    })}
                  </DayDropCell>
                ))}
              </div>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400 px-3 sm:px-4 py-2 border-t border-slate-100">
              {isCompact ? "Mo–Fr · " : "Mo–So · "}Farbe = Monteur · Gelb hervorgehoben = 17–19 Uhr{readOnly ? "" : " · Termine per Drag-and-drop verschieben"}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-2">
            <div className="grid grid-cols-7 border border-slate-100 rounded-lg overflow-hidden min-h-[500px]">
              {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
                <div key={d} className="py-2 text-center text-xs font-semibold text-slate-500 bg-slate-50 border-b border-slate-100">
                  {d}
                </div>
              ))}
              {monthDays.map((day) => {
                const dayApts = aptsForDay(day);
                const inMonth = isSameMonth(day, anchorDate);
                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-[90px] sm:min-h-[120px] border-b border-r border-slate-50 p-1.5 sm:p-2 ${!inMonth ? "bg-slate-50/60" : "bg-white"} ${isSameDay(day, new Date()) ? "ring-2 ring-inset ring-[#0d5c63]/30 bg-[#0d5c63]/5" : ""}`}
                  >
                    <p className={`text-xs sm:text-sm font-semibold mb-1 ${isSameDay(day, new Date()) ? "text-[#0d5c63]" : inMonth ? "text-slate-800" : "text-slate-300"}`}>
                      {format(day, "d.")}
                    </p>
                    <div className="space-y-1">
                      {dayApts.slice(0, 4).map((apt) => {
                        const color = getEmployeeColor(apt, employees);
                        const empInitial = apt.employee?.user.firstName.charAt(0) ?? "?";
                        return (
                          <Link
                            key={apt.id}
                            href={`/dashboard/auftraege/${apt.order.id}`}
                            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-white truncate shadow-sm"
                            style={{ backgroundColor: color }}
                            title={apt.employee?.user ? `${apt.employee.user.firstName} ${apt.employee.user.lastName}` : ""}
                          >
                            <span className="font-bold opacity-80">{empInitial}</span>
                            {format(new Date(apt.startTime), "HH:mm")} {apt.order.customer.lastName}
                          </Link>
                        );
                      })}
                      {dayApts.length > 4 && (
                        <p className="text-[10px] text-slate-400 pl-1">+{dayApts.length - 4} weitere</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DayDropCell({
  children,
  onDrop,
  gridHeight,
}: {
  children: React.ReactNode;
  onDrop: (e: React.DragEvent, ref: HTMLDivElement | null) => void;
  gridHeight: number;
}) {
  const [ref, setRef] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setRef}
      className="relative border-l border-slate-100 bg-white"
      style={{ height: gridHeight }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop(e, ref)}
    >
      {children}
    </div>
  );
}
