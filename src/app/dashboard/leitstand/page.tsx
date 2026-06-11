"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format, startOfWeek, endOfWeek, addDays, isSameDay } from "date-fns";
import { de } from "date-fns/locale";
import {
  Maximize2,
  Minimize2,
  RefreshCw,
  Users,
  Truck,
  Layers,
  Clock,
  ChevronLeft,
  CalendarDays,
} from "lucide-react";
import Link from "next/link";
import { PHASE_STATUS_LABELS } from "@/lib/utils";

interface BoardOrder {
  id: string;
  orderNumber: string;
  title: string;
  customer: string;
  address: string;
  status: string;
  phase: string;
  phaseStatus: string | null;
  team: string | null;
  vehicle: { name: string; licensePlate: string | null } | null;
  employees: string[];
  scheduledStart: string | null;
}

interface BoardEmployee {
  id: string;
  name: string;
  available: boolean;
  onAbsence: boolean;
  appointmentsToday: { orderNumber: string; startTime: string }[];
}

interface BoardTeam {
  id: string;
  name: string;
  vehicle: { name: string; licensePlate: string | null } | null;
  members: { employee: { user: { firstName: string; lastName: string } } }[];
}

interface WeekAppointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  order: {
    orderNumber: string;
    customer: { firstName: string; lastName: string } | null;
    team: { id: string; name: string } | null;
    vehicle: { name: string } | null;
  } | null;
  employee: { user: { firstName: string; lastName: string } } | null;
}

const REFRESH_MS = 30_000;
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 19;
const TIMELINE_HOURS = DAY_END_HOUR - DAY_START_HOUR;

export default function LeitstandPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [orders, setOrders] = useState<BoardOrder[]>([]);
  const [employees, setEmployees] = useState<BoardEmployee[]>([]);
  const [teams, setTeams] = useState<BoardTeam[]>([]);
  const [weekAppointments, setWeekAppointments] = useState<WeekAppointment[]>([]);
  const [now, setNow] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const loadData = useCallback(async () => {
    const weekFrom = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekTo = endOfWeek(new Date(), { weekStartsOn: 1 });
    const [t, a, w] = await Promise.all([
      fetch("/api/dashboard/today").then((r) => r.json()),
      fetch("/api/disposition/availability").then((r) => r.json()),
      fetch(
        `/api/appointments?from=${weekFrom.toISOString()}&to=${weekTo.toISOString()}`
      ).then((r) => r.json()),
    ]);
    if (t.success) setOrders(t.data.orders);
    if (a.success) {
      setEmployees(a.data.employees);
      setTeams(a.data.teams);
    }
    if (w.success) setWeekAppointments(w.data);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    // Asynchrones Laden – setState erfolgt erst nach await (kein synchroner Render-Loop).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
    const dataTimer = setInterval(loadData, REFRESH_MS);
    const clockTimer = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearInterval(dataTimer);
      clearInterval(clockTimer);
    };
  }, [loadData]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen?.().catch(() => undefined);
    } else {
      await document.exitFullscreen?.().catch(() => undefined);
    }
  }

  const availableCount = employees.filter((e) => e.available).length;

  return (
    <div ref={containerRef} className="bg-slate-950 text-slate-100 min-h-screen overflow-auto">
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Kopfzeile */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            {!isFullscreen && (
              <Link href="/dashboard/disposition" className="text-slate-400 hover:text-white">
                <ChevronLeft className="h-6 w-6" />
              </Link>
            )}
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Leitstand</h1>
              <p className="text-slate-400 text-sm capitalize">
                {format(now, "EEEE, d. MMMM yyyy", { locale: de })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="text-right">
              <p className="text-3xl sm:text-5xl font-bold tabular-nums leading-none">
                {format(now, "HH:mm")}
                <span className="text-lg sm:text-2xl text-slate-500">:{format(now, "ss")}</span>
              </p>
              {lastUpdated && (
                <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-end gap-1">
                  <RefreshCw className="h-3 w-3" /> aktualisiert {format(lastUpdated, "HH:mm:ss")}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded-lg bg-slate-800 hover:bg-slate-700 p-3 text-slate-200"
              title={isFullscreen ? "Vollbild beenden" : "Vollbild"}
            >
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Kennzahlen */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
          <StatTile label="Einsätze heute" value={orders.length} accent="text-cyan-400" />
          <StatTile label="Mitarbeiter verfügbar" value={`${availableCount}/${employees.length}`} accent="text-green-400" />
          <StatTile label="Aktive Teams" value={teams.length} accent="text-amber-400" />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Heutige Einsätze */}
          <div className="lg:col-span-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" /> Heutige Einsätze
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {orders.map((o) => (
                <div key={o.id} className="rounded-xl bg-slate-900 ring-1 ring-slate-800 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-lg font-bold text-cyan-400">{o.orderNumber}</span>
                    {o.scheduledStart && (
                      <span className="text-sm font-semibold tabular-nums text-slate-300">
                        {format(new Date(o.scheduledStart), "HH:mm")}
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-slate-100 truncate mt-0.5">{o.title}</p>
                  <p className="text-sm text-slate-400 truncate">{o.customer} · {o.address}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {o.phase && o.phase !== "—" && (
                      <Chip icon={<Layers className="h-3 w-3" />} className="bg-indigo-500/15 text-indigo-300">
                        {o.phase}{o.phaseStatus ? ` · ${PHASE_STATUS_LABELS[o.phaseStatus] ?? o.phaseStatus}` : ""}
                      </Chip>
                    )}
                    {o.team && (
                      <Chip icon={<Users className="h-3 w-3" />} className="bg-cyan-500/15 text-cyan-300">{o.team}</Chip>
                    )}
                    {o.vehicle && (
                      <Chip icon={<Truck className="h-3 w-3" />} className="bg-slate-500/20 text-slate-300">
                        {o.vehicle.name}{o.vehicle.licensePlate ? ` (${o.vehicle.licensePlate})` : ""}
                      </Chip>
                    )}
                  </div>
                  {o.employees.length > 0 && (
                    <p className="text-xs text-slate-400 mt-2">{o.employees.join(", ")}</p>
                  )}
                </div>
              ))}
              {!orders.length && (
                <p className="text-slate-500 col-span-full text-center py-10">Keine Einsätze heute geplant.</p>
              )}
            </div>
          </div>

          {/* Mitarbeiter & Teams */}
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" /> Mitarbeiter
              </h2>
              <div className="rounded-xl bg-slate-900 ring-1 ring-slate-800 divide-y divide-slate-800">
                {employees.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <span className="truncate">{e.name}</span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                        e.onAbsence
                          ? "bg-red-500/15 text-red-300"
                          : e.appointmentsToday.length > 0
                          ? "bg-amber-500/15 text-amber-300"
                          : "bg-green-500/15 text-green-300"
                      }`}
                    >
                      {e.onAbsence ? "Abwesend" : e.appointmentsToday.length > 0 ? "Im Einsatz" : "Verfügbar"}
                    </span>
                  </div>
                ))}
                {!employees.length && <p className="text-slate-500 text-center py-6 text-sm">Keine Mitarbeiter</p>}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" /> Teams
              </h2>
              <div className="space-y-2">
                {teams.map((t) => (
                  <div key={t.id} className="rounded-xl bg-slate-900 ring-1 ring-slate-800 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{t.name}</span>
                      {t.vehicle && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Truck className="h-3 w-3" /> {t.vehicle.name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 truncate">
                      {t.members.map((m) => `${m.employee.user.firstName} ${m.employee.user.lastName}`).join(", ") || "Keine Mitglieder"}
                    </p>
                  </div>
                ))}
                {!teams.length && <p className="text-slate-500 text-center py-6 text-sm">Keine Teams</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Wochen-Timeline (Mo–Fr) */}
        <div className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> Wochenübersicht (Mo–Fr, {DAY_START_HOUR}–{DAY_END_HOUR} Uhr)
          </h2>
          <WeekTimeline appointments={weekAppointments} now={now} />
        </div>
      </div>
    </div>
  );
}

function WeekTimeline({ appointments, now }: { appointments: WeekAppointment[]; now: Date }) {
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const days = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  const hourMarks = Array.from({ length: TIMELINE_HOURS + 1 }, (_, i) => DAY_START_HOUR + i);

  function teamColor(teamId: string | null | undefined): string {
    if (!teamId) return "bg-slate-600/70 ring-slate-500/40";
    const palette = [
      "bg-cyan-500/70 ring-cyan-400/40",
      "bg-amber-500/70 ring-amber-400/40",
      "bg-indigo-500/70 ring-indigo-400/40",
      "bg-emerald-500/70 ring-emerald-400/40",
      "bg-rose-500/70 ring-rose-400/40",
      "bg-violet-500/70 ring-violet-400/40",
    ];
    let hash = 0;
    for (let i = 0; i < teamId.length; i++) hash = (hash * 31 + teamId.charCodeAt(i)) >>> 0;
    return palette[hash % palette.length];
  }

  function blockGeometry(start: Date, end: Date) {
    const startH = start.getHours() + start.getMinutes() / 60;
    const endH = end.getHours() + end.getMinutes() / 60;
    const clampedStart = Math.max(startH, DAY_START_HOUR);
    const clampedEnd = Math.min(Math.max(endH, clampedStart + 0.25), DAY_END_HOUR);
    const left = ((clampedStart - DAY_START_HOUR) / TIMELINE_HOURS) * 100;
    const width = ((clampedEnd - clampedStart) / TIMELINE_HOURS) * 100;
    return { left, width };
  }

  return (
    <div className="rounded-xl bg-slate-900 ring-1 ring-slate-800 p-3 sm:p-4 overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Stundenraster-Kopf */}
        <div className="flex items-center mb-2">
          <div className="w-16 shrink-0" />
          <div className="relative flex-1 h-4">
            {hourMarks.map((h) => (
              <span
                key={h}
                className="absolute -translate-x-1/2 text-[10px] text-slate-500 tabular-nums"
                style={{ left: `${((h - DAY_START_HOUR) / TIMELINE_HOURS) * 100}%` }}
              >
                {h}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          {days.map((day) => {
            const dayAppts = appointments
              .filter((a) => isSameDay(new Date(a.startTime), day))
              .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
            const isToday = isSameDay(day, now);
            return (
              <div key={day.toISOString()} className="flex items-stretch gap-2">
                <div className={`w-16 shrink-0 py-1 text-xs font-medium ${isToday ? "text-cyan-300" : "text-slate-400"}`}>
                  <div className="capitalize">{format(day, "EE", { locale: de })}</div>
                  <div className="tabular-nums text-[11px] text-slate-500">{format(day, "dd.MM.")}</div>
                </div>
                <div className="relative flex-1 h-12 rounded-lg bg-slate-950/60 ring-1 ring-slate-800/80 overflow-hidden">
                  {/* Stunden-Trennlinien */}
                  {hourMarks.slice(1, -1).map((h) => (
                    <div
                      key={h}
                      className="absolute top-0 bottom-0 w-px bg-slate-800/60"
                      style={{ left: `${((h - DAY_START_HOUR) / TIMELINE_HOURS) * 100}%` }}
                    />
                  ))}
                  {/* Jetzt-Linie */}
                  {isToday &&
                    now.getHours() + now.getMinutes() / 60 >= DAY_START_HOUR &&
                    now.getHours() + now.getMinutes() / 60 <= DAY_END_HOUR && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                        style={{
                          left: `${((now.getHours() + now.getMinutes() / 60 - DAY_START_HOUR) / TIMELINE_HOURS) * 100}%`,
                        }}
                      />
                    )}
                  {dayAppts.map((a) => {
                    const { left, width } = blockGeometry(new Date(a.startTime), new Date(a.endTime));
                    const label = a.order?.team?.name ?? a.employee?.user?.lastName ?? a.order?.orderNumber ?? "";
                    return (
                      <div
                        key={a.id}
                        title={`${a.order?.orderNumber ?? ""} · ${format(new Date(a.startTime), "HH:mm")}–${format(new Date(a.endTime), "HH:mm")}${a.order?.team ? ` · ${a.order.team.name}` : ""}`}
                        className={`absolute top-1 bottom-1 rounded-md ring-1 px-1.5 flex items-center overflow-hidden ${teamColor(a.order?.team?.id)} ${a.status === "STORNIERT" ? "opacity-40 line-through" : ""}`}
                        style={{ left: `${left}%`, width: `${Math.max(width, 4)}%` }}
                      >
                        <span className="text-[10px] font-medium text-white truncate">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {!appointments.length && (
          <p className="text-slate-500 text-center py-4 text-sm">Keine Termine in dieser Woche.</p>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded-xl bg-slate-900 ring-1 ring-slate-800 p-4 text-center">
      <p className={`text-3xl sm:text-4xl font-bold tabular-nums ${accent}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  );
}

function Chip({ icon, children, className }: { icon: React.ReactNode; children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${className}`}>
      {icon}
      {children}
    </span>
  );
}
