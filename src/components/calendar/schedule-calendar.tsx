"use client";

import { useEffect, useRef, useState } from "react";
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
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Plus,
  SlidersHorizontal,
  Truck,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/ui/list-controls";
import {
  appointmentDisplayTitle,
  resolveAppointmentColor,
} from "@/lib/calendar/appointment-colors";

const DEFAULT_SLOT_DURATION_MS = 2 * 60 * 60 * 1000;

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
  teamId?: string | null;
  vehicleId?: string | null;
  projectId?: string | null;
  title?: string | null;
  color?: string | null;
  notes?: string | null;
  status?: string;
  addressText?: string | null;
  order: {
    id: string;
    orderNumber: string;
    title?: string | null;
    customer: { firstName: string; lastName: string };
    project?: { id: string; name: string } | null;
    team?: { id: string; name: string } | null;
    vehicle?: { id: string; name: string; licensePlate: string | null } | null;
  } | null;
  project?: { id: string; name: string } | null;
  team?: { id: string; name: string } | null;
  vehicle?: { id: string; name: string; licensePlate: string | null } | null;
  employee: { color: string; user: { firstName: string; lastName: string } } | null;
}

export type CalendarViewMode = "day" | "week" | "month";

interface ScheduleCalendarProps {
  view: CalendarViewMode;
  anchorDate: Date;
  appointments: CalendarAppointment[];
  loading?: boolean;
  employees: { id: string; user: { firstName: string; lastName: string }; color: string }[];
  selectedEmployeeIds: string[];
  onSelectedEmployeeIdsChange: (ids: string[]) => void;
  onAnchorChange: (date: Date) => void;
  onViewChange: (view: CalendarViewMode) => void;
  onAppointmentReschedule: (
    appointmentId: string,
    startTime: Date,
    endTime: Date,
    employeeId: string
  ) => Promise<void>;
  /** Leeren Zeitraum anklicken/tippen → Termin erstellen. */
  onSlotSelect?: (slot: { start: Date; end: Date; employeeIdHint?: string }) => void;
  /** Termin anklicken → bearbeiten. */
  onAppointmentClick?: (appointment: CalendarAppointment) => void;
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

function gridMinutesFromY(clientY: number, rectTop: number, hourHeight: number): number {
  const y = Math.max(0, clientY - rectTop);
  const rawMinutes = HOUR_START * 60 + (y / hourHeight) * 60;
  const snappedMinutes = Math.round(rawMinutes / 15) * 15;
  return Math.min(HOUR_END * 60, Math.max(HOUR_START * 60, snappedMinutes));
}

function dropTimeFromY(clientY: number, rectTop: number, hourHeight: number): { hour: number; minute: number } {
  const totalMinutes = gridMinutesFromY(clientY, rectTop, hourHeight);
  return { hour: Math.floor(totalMinutes / 60), minute: totalMinutes % 60 };
}

function formatGridMinutes(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function getEmployeeColor(
  apt: CalendarAppointment,
  employees: { id: string; color: string }[]
): string {
  const empColor =
    apt.employee?.color ??
    (apt.employeeId ? employees.find((e) => e.id === apt.employeeId)?.color : null);
  return resolveAppointmentColor({ color: apt.color, employeeColor: empColor });
}

function eventLabel(apt: CalendarAppointment): string {
  return appointmentDisplayTitle({ title: apt.title, order: apt.order });
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
  loading = false,
  employees,
  selectedEmployeeIds,
  onSelectedEmployeeIdsChange,
  onAnchorChange,
  onViewChange,
  onAppointmentReschedule,
  onSlotSelect,
  onAppointmentClick,
  readOnly = false,
  teams = [],
  selectedTeamIds = [],
  onSelectedTeamIdsChange,
  vehicles = [],
  selectedVehicleIds = [],
  onSelectedVehicleIdsChange,
}: ScheduleCalendarProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // Browserzeit erst nach der Hydrierung setzen, damit die laufende Minutenanzeige
    // nicht zwischen Server-HTML und erstem Client-Render abweicht.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Tag = 1, Woche = immer Mo–So (auch mobil), Monat separat
  const isCompact = useMediaQuery("(max-width: 1024px)");
  const dayCount = view === "day" ? 1 : 7;
  const hourHeight = isCompact || view === "day" ? 40 : 48;
  const timeColW = isCompact ? 40 : 64;
  const gridHeight = HOURS.length * hourHeight;
  const gridTemplate = `${timeColW}px repeat(${dayCount}, minmax(0, 1fr))`;

  const weekStart =
    view === "day"
      ? new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate())
      : startOfWeek(anchorDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: dayCount }, (_, i) => addDays(weekStart, i));
  const monthStart = startOfMonth(anchorDate);
  const monthGridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const monthGridEnd = endOfWeek(endOfMonth(anchorDate), { weekStartsOn: 1 });
  const monthDays = eachDayOfInterval({ start: monthGridStart, end: monthGridEnd });

  const teamFilterActive = teams.length > 0 && selectedTeamIds.length > 0;
  const vehicleFilterActive = vehicles.length > 0 && selectedVehicleIds.length > 0;
  const showFilters =
    (teams.length > 0 && !!onSelectedTeamIdsChange) ||
    (vehicles.length > 0 && !!onSelectedVehicleIdsChange);

  function navigate(dir: -1 | 1) {
    if (view === "day") onAnchorChange(addDays(anchorDate, dir));
    else if (view === "month") onAnchorChange(addMonths(anchorDate, dir));
    else onAnchorChange(addWeeks(anchorDate, dir));
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
    const teamId = a.teamId ?? a.team?.id ?? a.order?.team?.id;
    const vehicleId = a.vehicleId ?? a.vehicle?.id ?? a.order?.vehicle?.id;
    if (teamFilterActive && !(teamId && selectedTeamIds.includes(teamId))) return false;
    if (vehicleFilterActive && !(vehicleId && selectedVehicleIds.includes(vehicleId))) return false;
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

  function openSlotAt(day: Date, clientY: number, cellTop: number) {
    if (readOnly || !onSlotSelect) return;
    const { hour, minute } = dropTimeFromY(clientY, cellTop, hourHeight);
    const start = setMinutes(setHours(day, hour), minute);
    const end = new Date(start.getTime() + DEFAULT_SLOT_DURATION_MS);
    onSlotSelect({
      start,
      end,
      employeeIdHint: selectedEmployeeIds.length === 1 ? selectedEmployeeIds[0] : undefined,
    });
  }

  function openSlotRange(day: Date, startClientY: number, endClientY: number, cellTop: number) {
    if (readOnly || !onSlotSelect) return;
    const firstMinutes = gridMinutesFromY(startClientY, cellTop, hourHeight);
    const secondMinutes = gridMinutesFromY(endClientY, cellTop, hourHeight);
    const startMinutes = Math.min(firstMinutes, secondMinutes);
    const endMinutes = Math.max(firstMinutes, secondMinutes);
    if (endMinutes - startMinutes < 15) {
      openSlotAt(day, endClientY, cellTop);
      return;
    }

    const start = setMinutes(setHours(day, Math.floor(startMinutes / 60)), startMinutes % 60);
    const end = setMinutes(setHours(day, Math.floor(endMinutes / 60)), endMinutes % 60);
    onSlotSelect({
      start,
      end,
      employeeIdHint: selectedEmployeeIds.length === 1 ? selectedEmployeeIds[0] : undefined,
    });
  }

  function openDayDefaultSlot(day: Date) {
    if (readOnly || !onSlotSelect) return;
    const start = setMinutes(setHours(day, 9), 0);
    const end = new Date(start.getTime() + DEFAULT_SLOT_DURATION_MS);
    onSlotSelect({
      start,
      end,
      employeeIdHint: selectedEmployeeIds.length === 1 ? selectedEmployeeIds[0] : undefined,
    });
  }

  function startResize(
    e: React.PointerEvent,
    apt: CalendarAppointment,
    cellEl: HTMLElement | null
  ) {
    if (readOnly || !cellEl) return;
    e.preventDefault();
    e.stopPropagation();
    const employeeId = apt.employeeId ?? selectedEmployeeIds[0] ?? "";
    if (!employeeId) return;

    const start = new Date(apt.startTime);
    setResizingId(apt.id);

    const onMove = () => {
      /* Speichern erst beim Loslassen – Snap auf 15 Min. */
    };

    const onUp = async (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setResizingId(null);
      const rect = cellEl.getBoundingClientRect();
      const { hour, minute } = dropTimeFromY(ev.clientY, rect.top, hourHeight);
      let newEnd = setMinutes(setHours(start, hour), minute);
      // Ende bezieht sich auf denselben Tag wie Start (Wochenraster-Spalte)
      newEnd = setMinutes(setHours(start, hour), minute);
      const minEnd = new Date(start.getTime() + 15 * 60 * 1000);
      if (newEnd < minEnd) newEnd = minEnd;
      if (newEnd.getTime() === new Date(apt.endTime).getTime()) return;
      await onAppointmentReschedule(apt.id, start, newEnd, employeeId);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const headerLabel =
    view === "day"
      ? format(anchorDate, "EEEE, d. MMMM yyyy", { locale: de })
      : view === "month"
        ? format(anchorDate, "MMMM yyyy", { locale: de })
        : `${format(weekStart, "d. MMM", { locale: de })} – ${format(addDays(weekStart, dayCount - 1), "d. MMM yyyy", { locale: de })}`;

  const visibleCount = selectedEmployeeIds.length;
  const visibleAppointmentCount = appointments.filter(isVisible).length;
  const normalizedEmployeeQuery = employeeQuery.trim().toLocaleLowerCase("de");
  const filteredEmployees = normalizedEmployeeQuery
    ? employees.filter((employee) =>
        `${employee.user.firstName} ${employee.user.lastName}`
          .toLocaleLowerCase("de")
          .includes(normalizedEmployeeQuery)
      )
    : employees;
  const activeFilterCount = selectedTeamIds.length + selectedVehicleIds.length;

  const filterPanel = (
    <>
      <div className="border-b border-slate-200/80 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <CalendarDays className="h-4 w-4 text-[#0d5c63]" /> Kalender
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {visibleCount} von {employees.length} Personen sichtbar
            </p>
          </div>
          <button
            type="button"
            aria-label="Filter schließen"
            className="rounded-full p-1 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 lg:hidden"
            onClick={() => setMobileFilterOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {employees.length > 5 && (
          <SearchField
            label="Mitarbeiter durchsuchen"
            value={employeeQuery}
            onValueChange={setEmployeeQuery}
            placeholder="Mitarbeiter suchen …"
            containerClassName="mt-3"
          />
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {filteredEmployees.map((emp) => {
          const active = selectedEmployeeIds.includes(emp.id);
          return (
            <button
              key={emp.id}
              type="button"
              onClick={() => toggleEmployee(emp.id)}
              className={`group w-full flex items-center gap-2.5 py-2 px-2.5 rounded-lg text-left text-sm transition ${
                active ? "bg-white shadow-sm ring-1 ring-slate-200/80" : "text-slate-500 hover:bg-white/70"
              }`}
            >
              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] text-white shadow-sm"
                style={{ backgroundColor: active ? emp.color : "#cbd5e1" }}
              >
                {active && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
              <span className={`truncate font-medium ${active ? "text-slate-800" : "text-slate-500"}`}>
                {emp.user.firstName} {emp.user.lastName}
              </span>
            </button>
          );
        })}
        {filteredEmployees.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-slate-500">
            Keine passende Person gefunden.
          </p>
        )}

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
    <div className="relative flex h-full min-h-0 overflow-hidden rounded-[20px] border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
      {mobileFilterOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[1px] lg:hidden"
          aria-label="Filter schließen"
          onClick={() => setMobileFilterOpen(false)}
        />
      )}

      <aside className="sticky top-0 hidden h-full max-h-full w-64 shrink-0 self-start flex-col overflow-hidden border-r border-slate-200/80 bg-[#f6f6f8] lg:flex">
        {filterPanel}
      </aside>

      {mobileFilterOpen && (
        <aside className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[86vw] animate-in flex-col border-r border-slate-200 bg-[#f6f6f8] shadow-2xl slide-in-from-left-4 duration-200 lg:hidden">
          {filterPanel}
        </aside>
      )}

      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <div className="border-b border-slate-200/80 bg-white/95 px-3 py-3 backdrop-blur sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex"
                onClick={() => onAnchorChange(new Date())}
              >
                Heute
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Vorheriger Zeitraum"
                onClick={() => navigate(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Nächster Zeitraum"
                onClick={() => navigate(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <h2 className="ml-1 truncate text-base font-semibold capitalize tracking-tight text-slate-950 sm:ml-2 sm:text-lg">
                {headerLabel}
              </h2>
              {loading && (
                <LoaderCircle
                  className="ml-1 h-4 w-4 shrink-0 animate-spin text-[#0d5c63]"
                  aria-label="Termine werden geladen"
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              {!readOnly && onSlotSelect && (
                <Button
                  size="sm"
                  className="gap-1 bg-[#0d5c63] shadow-sm hover:bg-[#0a4a50]"
                  onClick={() => openDayDefaultSlot(anchorDate)}
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Neuer Termin</span>
                </Button>
              )}
              <button
                type="button"
                onClick={() => setMobileFilterOpen(true)}
                className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-[#0d5c63]/25 hover:text-[#0d5c63] lg:hidden"
                aria-label={`${visibleCount} Personen auswählen`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="hidden min-[460px]:inline">Personen</span>
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-slate-100 px-1.5 text-xs font-semibold text-slate-600">
                  {visibleCount}
                </span>
                {activeFilterCount > 0 ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#0d5c63]" aria-hidden="true" />
                ) : null}
              </button>
            {/* Mobil: kompakte Auswahl statt Segmentsteuerung */}
            <select
              value={view}
              onChange={(e) => onViewChange(e.target.value as CalendarViewMode)}
              className="sm:hidden h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm font-medium text-slate-700"
              aria-label="Ansicht wählen"
            >
              <option value="day">Tag</option>
              <option value="week">Woche Mo–So</option>
              <option value="month">Monat</option>
            </select>
            <div className="hidden overflow-hidden rounded-lg bg-slate-100 p-0.5 sm:flex">
              {(
                [
                  ["day", "Tag"],
                  ["week", "Mo–So"],
                  ["month", "Monat"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onViewChange(id)}
                  className={`rounded-[7px] px-2 py-1.5 text-xs font-medium transition sm:px-3 sm:text-sm ${
                    view === id ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 sm:mt-2.5">
            <span>
              {visibleAppointmentCount} {visibleAppointmentCount === 1 ? "Termin" : "Termine"}
            </span>
            <span aria-hidden="true" className="h-1 w-1 rounded-full bg-slate-300" />
            <span>
              {visibleCount} {visibleCount === 1 ? "Person" : "Personen"}
            </span>
            {activeFilterCount > 0 && (
              <>
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-slate-300" />
                <button
                  type="button"
                  onClick={() => {
                    onSelectedTeamIdsChange?.([]);
                    onSelectedVehicleIdsChange?.([]);
                  }}
                  className="font-medium text-[#0d5c63] hover:underline"
                >
                  Filter zurücksetzen
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => onAnchorChange(new Date())}
              className="ml-auto font-medium text-[#0d5c63] sm:hidden"
            >
              Heute
            </button>
          </div>
        </div>

        {view !== "month" ? (
          <div className="flex-1 overflow-auto">
            <div
              className={
                isCompact && dayCount >= 7
                  ? "min-w-[720px]"
                  : isCompact
                    ? "min-w-0"
                    : "min-w-[640px]"
              }
            >
              {/* Kopfzeile: Wochentage */}
              <div className="sticky top-0 z-30 grid border-b border-slate-200/80 bg-white/95 backdrop-blur" style={{ gridTemplateColumns: gridTemplate }}>
                <div className="border-r border-slate-100" />
                {weekDays.map((day) => (
                  <div
                    key={day.toISOString()}
                    className="border-l border-slate-100 py-2 text-center"
                  >
                    <p className={`text-[10px] font-medium uppercase sm:text-xs ${now && isSameDay(day, now) ? "text-red-500" : "text-slate-500"}`}>{format(day, "EEE", { locale: de })}</p>
                    <span className={`mt-0.5 inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-base font-semibold sm:h-8 sm:min-w-8 sm:text-lg ${now && isSameDay(day, now) ? "bg-red-500 text-white" : "text-slate-800"}`}>
                      {format(day, "d")}
                    </span>
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
                      const label = eventLabel(apt);
                      return (
                        <button
                          type="button"
                          key={apt.id}
                          onClick={() => onAppointmentClick?.(apt)}
                          title={`${empName} · ${label} (mehrtägig)`}
                          className="absolute flex h-[19px] items-center gap-1 truncate rounded-md border px-2 text-left text-[11px] font-semibold leading-[19px] shadow-sm transition hover:brightness-95"
                          style={{
                            left: `calc(${(startCol / dayCount) * 100}% + 3px)`,
                            width: `calc(${(span / dayCount) * 100}% - 6px)`,
                            top: lane * 22 + 4,
                            backgroundColor: `color-mix(in srgb, ${color} 16%, white)`,
                            borderColor: `color-mix(in srgb, ${color} 38%, white)`,
                            color,
                          }}
                        >
                          <span className="truncate">
                            {label}
                            {empName ? ` · ${empName}` : ""}
                          </span>
                        </button>
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
                  <DayDropCell
                    key={day.toISOString()}
                    gridHeight={gridHeight}
                    hourHeight={hourHeight}
                    onDrop={(e, ref) => handleDrop(e, day, ref)}
                    onSlotClick={
                      readOnly || !onSlotSelect
                        ? undefined
                        : (clientY, rectTop) => openSlotAt(day, clientY, rectTop)
                    }
                    onSlotRangeSelect={
                      readOnly || isCompact || !onSlotSelect
                        ? undefined
                        : (startClientY, endClientY, rectTop) =>
                            openSlotRange(day, startClientY, endClientY, rectTop)
                    }
                  >
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

                    {now &&
                      isSameDay(day, now) &&
                      now.getHours() >= HOUR_START &&
                      now.getHours() <= HOUR_END && (
                        <div
                          className="pointer-events-none absolute left-0 right-0 z-20 border-t border-red-500"
                          style={{
                            top:
                              ((now.getHours() * 60 + now.getMinutes() - HOUR_START * 60) / 60) *
                              hourHeight,
                          }}
                          aria-hidden="true"
                        >
                          <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
                        </div>
                      )}

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
                          data-appointment
                          draggable={!readOnly && !isCompact && resizingId !== apt.id}
                          onDragStart={
                            readOnly || isCompact
                              ? undefined
                              : (e) => {
                                  e.dataTransfer.setData("appointmentId", apt.id);
                                  setDraggingId(apt.id);
                                }
                          }
                          onDragEnd={readOnly || isCompact ? undefined : () => setDraggingId(null)}
                          onClick={() => onAppointmentClick?.(apt)}
                          title={`${empName} · ${eventLabel(apt)}`}
                          className={`absolute z-10 cursor-pointer overflow-hidden rounded-md border border-l-[3px] px-1.5 py-1 text-left shadow-sm transition hover:brightness-95 sm:px-2 ${!readOnly && !isCompact ? "active:cursor-grabbing" : ""} ${draggingId === apt.id || resizingId === apt.id ? "opacity-40 ring-2 ring-[#0d5c63]" : ""}`}
                          style={{
                            top,
                            height,
                            left: `calc(${leftPct}% + 2px)`,
                            width: `calc(${widthPct}% - 4px)`,
                            backgroundColor: `color-mix(in srgb, ${color} 14%, white)`,
                            borderColor: `color-mix(in srgb, ${color} 35%, white)`,
                            borderLeftColor: color,
                          }}
                        >
                          <div className="block h-full min-h-0 pointer-events-none">
                            <p className="truncate text-[10px] font-bold leading-tight text-slate-900 sm:text-[11px]">
                              {format(start, "HH:mm")} {eventLabel(apt)}
                            </p>
                            {height > 34 && empName && (
                              <p className="truncate text-[9px] text-slate-600 sm:text-[10px]">{empName}</p>
                            )}
                            {height > 50 && apt.order?.orderNumber && (
                              <p className="truncate text-[9px] text-slate-500 sm:text-[10px]">{apt.order.orderNumber}</p>
                            )}
                          </div>
                          {!readOnly && !isCompact && (
                            <div
                              role="separator"
                              aria-label="Dauer ändern"
                              className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize touch-none pointer-events-auto"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                const cell = (e.currentTarget.closest("[data-day-cell]") as HTMLElement | null);
                                startResize(e, apt, cell);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                        </div>
                      );
                    })}
                  </DayDropCell>
                ))}
              </div>
            </div>
            <p className="border-t border-slate-100 px-3 py-2 text-[10px] text-slate-400 sm:px-4 sm:text-xs">
              {view === "day"
                ? "Tagesansicht · "
                : "Mo–So · "}
              Farben nach Mitarbeiter · Gelb = 17–19 Uhr
              {readOnly
                ? ""
                : isCompact
                  ? " · Tippen zum Erstellen/Bearbeiten"
                  : " · Ziehen = Zeitraum erstellen · Termin ziehen = verschieben · Unterkante = Dauer"}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-2 sm:p-3">
            <div className="grid min-h-[500px] grid-cols-7 overflow-hidden rounded-xl border border-slate-200/80">
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
                    role={!readOnly && onSlotSelect ? "button" : undefined}
                    tabIndex={!readOnly && onSlotSelect ? 0 : undefined}
                    onClick={
                      readOnly || !onSlotSelect
                        ? undefined
                        : (e) => {
                            if ((e.target as HTMLElement).closest("[data-appointment]")) return;
                            openDayDefaultSlot(day);
                          }
                    }
                    onKeyDown={
                      readOnly || !onSlotSelect
                        ? undefined
                        : (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openDayDefaultSlot(day);
                            }
                          }
                    }
                    className={`min-h-[90px] border-b border-r border-slate-100 p-1.5 sm:min-h-[120px] sm:p-2 ${!inMonth ? "bg-slate-50/70" : "bg-white"} ${!readOnly && onSlotSelect ? "cursor-pointer hover:bg-slate-50/70" : ""}`}
                  >
                    <span className={`mb-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold sm:text-sm ${now && isSameDay(day, now) ? "bg-red-500 text-white" : inMonth ? "text-slate-800" : "text-slate-300"}`}>
                      {format(day, "d")}
                    </span>
                    <div className="space-y-1">
                      {dayApts.slice(0, 4).map((apt) => {
                        const color = getEmployeeColor(apt, employees);
                        const empInitial = apt.employee?.user.firstName.charAt(0) ?? "?";
                        return (
                          <button
                            type="button"
                            key={apt.id}
                            data-appointment
                            onClick={(e) => {
                              e.stopPropagation();
                              onAppointmentClick?.(apt);
                            }}
                            className="flex w-full items-center gap-1 truncate rounded border-l-2 px-1.5 py-0.5 text-left text-[10px] font-medium text-slate-800 shadow-sm transition hover:brightness-95"
                            style={{
                              backgroundColor: `color-mix(in srgb, ${color} 14%, white)`,
                              borderLeftColor: color,
                            }}
                            title={
                              apt.employee?.user
                                ? `${apt.employee.user.firstName} ${apt.employee.user.lastName}`
                                : eventLabel(apt)
                            }
                          >
                            <span className="font-bold opacity-80">{empInitial}</span>
                            {format(new Date(apt.startTime), "HH:mm")} {eventLabel(apt)}
                          </button>
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
  onSlotClick,
  onSlotRangeSelect,
  gridHeight,
  hourHeight,
}: {
  children: React.ReactNode;
  onDrop: (e: React.DragEvent, ref: HTMLDivElement | null) => void;
  onSlotClick?: (clientY: number, rectTop: number) => void;
  onSlotRangeSelect?: (startClientY: number, endClientY: number, rectTop: number) => void;
  gridHeight: number;
  hourHeight: number;
}) {
  const [ref, setRef] = useState<HTMLDivElement | null>(null);
  const pointerDown = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const [selection, setSelection] = useState<{ startY: number; currentY: number } | null>(null);

  const selectionStyle = selection
    ? (() => {
        const top = Math.max(0, Math.min(selection.startY, selection.currentY));
        const bottom = Math.min(gridHeight, Math.max(selection.startY, selection.currentY));
        const snappedStart = gridMinutesFromY(top, 0, hourHeight);
        const snappedEnd = gridMinutesFromY(bottom, 0, hourHeight);
        return {
          top: ((snappedStart - HOUR_START * 60) / 60) * hourHeight,
          height: Math.max(((snappedEnd - snappedStart) / 60) * hourHeight, 12),
          label: `${formatGridMinutes(snappedStart)}–${formatGridMinutes(snappedEnd)}`,
        };
      })()
    : null;

  return (
    <div
      ref={setRef}
      data-day-cell
      className="relative border-l border-slate-100 bg-white"
      style={{ height: gridHeight }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop(e, ref)}
      onPointerDown={(e) => {
        if (!onSlotClick) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        if ((e.target as HTMLElement).closest("[data-appointment]")) return;
        pointerDown.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
        if (onSlotRangeSelect && ref) {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          const rect = ref.getBoundingClientRect();
          const y = Math.max(0, Math.min(gridHeight, e.clientY - rect.top));
          setSelection({ startY: y, currentY: y });
        }
      }}
      onPointerMove={(e) => {
        if (!selection || !ref || pointerDown.current?.pointerId !== e.pointerId) return;
        const rect = ref.getBoundingClientRect();
        setSelection((current) =>
          current
            ? { ...current, currentY: Math.max(0, Math.min(gridHeight, e.clientY - rect.top)) }
            : null
        );
      }}
      onPointerUp={(e) => {
        if (!onSlotClick || !ref || !pointerDown.current) {
          pointerDown.current = null;
          setSelection(null);
          return;
        }
        const down = pointerDown.current;
        const dx = Math.abs(e.clientX - down.x);
        const dy = Math.abs(e.clientY - down.y);
        pointerDown.current = null;
        if ((e.target as HTMLElement).closest("[data-appointment]")) return;
        const rect = ref.getBoundingClientRect();
        setSelection(null);
        if (onSlotRangeSelect && (dx > 8 || dy > 8)) {
          onSlotRangeSelect(down.y, e.clientY, rect.top);
          return;
        }
        onSlotClick(e.clientY, rect.top);
      }}
      onPointerCancel={() => {
        pointerDown.current = null;
        setSelection(null);
      }}
    >
      {selectionStyle && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-1 z-30 overflow-hidden rounded-xl border border-[#0b6268]/45 bg-[#0b6268]/15 shadow-[0_10px_28px_rgba(11,98,104,0.16)] backdrop-blur-[2px]"
          style={{ top: selectionStyle.top, height: selectionStyle.height }}
        >
          <span className="inline-flex rounded-br-lg bg-[#0b6268] px-2 py-1 text-[10px] font-semibold text-white shadow-sm">
            {selectionStyle.label}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}
