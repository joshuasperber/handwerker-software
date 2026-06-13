"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MonteurMaterialView } from "@/components/monteur/material-view";
import { APPOINTMENT_STATUS_LABELS, PHASE_STATUS_LABELS, PHASE_STATUS_BADGE, formatDateTime, orderServiceLabel } from "@/lib/utils";
import { fetchJson } from "@/lib/fetch-json";
import { getCurrentPhase, phaseAssigneeLabel, type PhaseSummary } from "@/lib/phase-status";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Package, MapPin, Smartphone, Layers } from "lucide-react";

interface Appointment {
  id: string;
  startTime: string;
  status: string;
  order: {
    id: string;
    orderNumber: string;
    customer: { firstName: string; lastName: string };
    property: { street: string; city: string };
    services: { service: { name: string } | null; customName?: string | null }[];
    phases?: PhaseSummary[];
  };
}

export function MonteurDashboardOverview() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(today);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pickupData, setPickupData] = useState<{ byOrder: unknown[]; aggregated: unknown[] } | null>(null);
  const [totalHours, setTotalHours] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const weekStart = format(startOfWeek(new Date(selectedDate), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const weekEnd = format(endOfWeek(new Date(selectedDate), { weekStartsOn: 1 }), "yyyy-MM-dd");

    const [schedule, pickup, timesheet] = await Promise.all([
      fetchJson<Appointment[]>(`/api/monteur/schedule?date=${selectedDate}`),
      fetchJson<{ byOrder: unknown[]; aggregated: unknown[] }>(`/api/monteur/pickup?date=${selectedDate}`),
      fetchJson<{ totalHours: number }>(`/api/monteur/timesheet?from=${weekStart}&to=${weekEnd}`),
    ]);

    if (schedule.success && schedule.data) setAppointments(schedule.data);
    if (pickup.success && pickup.data) {
      setPickupData({ byOrder: pickup.data.byOrder, aggregated: pickup.data.aggregated });
    }
    if (timesheet.success && timesheet.data) setTotalHours(timesheet.data.totalHours);
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    // Absichtlicher Lade-Indikator beim (Neu-)Laden – Daten kommen asynchron.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const dateLabel = format(new Date(selectedDate), "EEEE, d. MMMM yyyy", { locale: de });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mein Tag</h1>
          <p className="text-sm text-slate-500 mt-1">{dateLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          />
          <Link href="/monteur">
            <Button variant="outline" size="sm">
              <Smartphone className="h-4 w-4 mr-1" /> Feld-App
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/monteur/tagesplan">
          <Card className="!p-4 hover:shadow-md transition-shadow h-full">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg text-[#0d5c63] bg-[#0d5c63]/10">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Tagesaufträge</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  {loading ? "…" : `${appointments.length} Termin${appointments.length === 1 ? "" : "e"}`}
                </p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/monteur/material">
          <Card className="!p-4 hover:shadow-md transition-shadow h-full">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg text-orange-700 bg-orange-50">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Material heute</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  {loading ? "…" : `${pickupData?.aggregated?.length ?? 0} Positionen abholen`}
                </p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/monteur/stundenzettel">
          <Card className="!p-4 hover:shadow-md transition-shadow h-full">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg text-blue-700 bg-blue-50">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Stunden (Woche)</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  {loading ? "…" : `${totalHours} h erfasst`}
                </p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      <Card title={`Tagesaufträge · ${format(new Date(selectedDate), "dd.MM.yyyy")}`}>
        {loading ? (
          <p className="text-slate-500 py-6 text-center text-sm">Laden…</p>
        ) : appointments.length === 0 ? (
          <p className="text-slate-500 py-6 text-center text-sm">Keine Termine an diesem Tag.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {appointments.map((apt) => {
              const currentPhase = getCurrentPhase(apt.order.phases);
              const assignee = phaseAssigneeLabel(currentPhase);
              return (
              <Link
                key={apt.id}
                href={`/monteur/auftrag/${apt.order.id}`}
                className="flex items-center justify-between py-3 hover:bg-slate-50 -mx-2 px-2 rounded-lg"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <Clock className="h-4 w-4 text-slate-400 mt-1 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium">{formatDateTime(apt.startTime)}</p>
                    <p className="text-sm text-slate-600">
                      {apt.order.orderNumber} · {apt.order.customer.firstName} {apt.order.customer.lastName}
                    </p>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {apt.order.property.street}, {apt.order.property.city}
                    </p>
                    {apt.order.services.length > 0 && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {apt.order.services.map((s) => orderServiceLabel(s)).join(", ")}
                      </p>
                    )}
                    {currentPhase && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                        <Layers className="h-3 w-3 shrink-0" />
                        {currentPhase.name}
                        {assignee ? ` · ${assignee}` : ""}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge status={apt.status} label={APPOINTMENT_STATUS_LABELS[apt.status] ?? apt.status} />
                  {currentPhase && (
                    <Badge
                      status={PHASE_STATUS_BADGE[currentPhase.status] ?? "DRAFT"}
                      label={PHASE_STATUS_LABELS[currentPhase.status] ?? currentPhase.status}
                    />
                  )}
                </div>
              </Link>
              );
            })}
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <Link href="/monteur/tagesplan" className="text-sm text-[#0d5c63] hover:underline">
            In der Feld-App starten (Navigation, Checkliste, Abschluss) →
          </Link>
        </div>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Material fürs Lager / Fahrzeug</h2>
        <MonteurMaterialView
          date={format(new Date(selectedDate), "EEEE, d. MMMM", { locale: de })}
          byOrder={(pickupData?.byOrder ?? []) as Parameters<typeof MonteurMaterialView>[0]["byOrder"]}
          aggregated={(pickupData?.aggregated ?? []) as Parameters<typeof MonteurMaterialView>[0]["aggregated"]}
          loading={loading}
        />
      </div>
    </div>
  );
}
