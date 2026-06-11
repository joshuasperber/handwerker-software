"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APPOINTMENT_STATUS_LABELS, PHASE_STATUS_LABELS, PHASE_STATUS_BADGE, formatDateTime } from "@/lib/utils";
import { getCurrentPhase, phaseAssigneeLabel, type PhaseSummary } from "@/lib/phase-status";
import { MonteurWeekCalendar } from "@/components/monteur/week-calendar";
import { MonteurMaterialView } from "@/components/monteur/material-view";
import { calcPickupWithReserve } from "@/lib/monteur/pickup-list";
import {
  MapPin, Phone, Navigation, CheckCircle, Camera, Package,
  Car, MapPinned, Play, Pause, Layers, Users,
} from "lucide-react";
import { format, startOfWeek } from "date-fns";
import { de } from "date-fns/locale";

interface MaterialLine {
  id: string;
  name: string;
  quantityRequired: number;
  unit: string;
  isTool: boolean;
  reservations?: { status: string; storageLocation?: { name: string } }[];
}

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    description: string | null;
    materialStatus?: string;
    customer: { firstName: string; lastName: string; phone: string | null };
    property: { street: string; zipCode: string; city: string };
    services: { service: { name: string } | null; customName?: string | null }[];
    checklists: { id: string; label: string; isChecked: boolean }[];
    materialLines?: MaterialLine[];
    phases?: PhaseSummary[];
    team?: { id: string; name: string } | null;
    vehicle?: { id: string; name: string; licensePlate: string | null } | null;
  };
}

const STATUS_ACTIONS = [
  { status: "UNTERWEGS", label: "Losfahren", icon: Car, variant: "action" as const },
  { status: "ANGEKOMMEN", label: "Angekommen", icon: MapPinned, variant: "primary" as const },
  { status: "IN_ARBEIT", label: "Arbeit starten", icon: Play, variant: "primary" as const },
];

const TAB_ACTIVE = "bg-slate-200 text-slate-900";
const TAB_INACTIVE = "text-slate-500 hover:bg-slate-100";

function MonteurPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const view = searchParams.get("view") ?? "week";

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [weekDays, setWeekDays] = useState<Record<string, Appointment[]>>({});
  const [weekStart, setWeekStart] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [pickupData, setPickupData] = useState<{ byOrder: unknown[]; aggregated: unknown[] } | null>(null);
  const [pickupLoading, setPickupLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [vehicleFilter, setVehicleFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<Record<string, string>>({});
  const [completionNotes, setCompletionNotes] = useState<Record<string, string>>({});
  const [completionMsg, setCompletionMsg] = useState<Record<string, string>>({});
  const [completionError, setCompletionError] = useState<Record<string, string>>({});
  const [staffRequests, setStaffRequests] = useState<{
    id: string;
    message: string | null;
    startTime: string | null;
    order: { id: string; orderNumber: string; customer: { firstName: string; lastName: string }; property: { street: string; city: string } };
    requestedBy: { firstName: string; lastName: string };
  }[]>([]);

  const loadSchedule = useCallback(() => {
    fetch(`/api/monteur/schedule?date=${selectedDate}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setAppointments(d.data); });
  }, [selectedDate]);

  const loadWeek = useCallback(() => {
    fetch(`/api/monteur/schedule?weekStart=${weekStart}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setWeekDays(d.data.days ?? {}); });
  }, [weekStart]);

  const loadPickup = useCallback(() => {
    setPickupLoading(true);
    fetch(`/api/monteur/pickup?date=${selectedDate}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setPickupData({ byOrder: d.data.byOrder, aggregated: d.data.aggregated });
      })
      .finally(() => setPickupLoading(false));
  }, [selectedDate]);

  useEffect(() => { if (view === "day") loadSchedule(); }, [loadSchedule, view]);
  useEffect(() => { if (view === "week") loadWeek(); }, [loadWeek, view]);
  useEffect(() => {
    // loadPickup setzt bewusst einen Lade-Indikator; Daten folgen asynchron.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (view === "material") loadPickup();
  }, [loadPickup, view]);

  const loadRequests = useCallback(() => {
    fetch(`/api/staff-requests?mine=1&date=${selectedDate}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setStaffRequests(d.data); });
  }, [selectedDate]);

  useEffect(() => { if (view === "day") loadRequests(); }, [loadRequests, view]);

  const nextAppointment = appointments.find(
    (a) => !["ABGESCHLOSSEN", "STORNIERT"].includes(a.status)
  );

  const teamOptions = Array.from(
    new Map(
      appointments.filter((a) => a.order.team).map((a) => [a.order.team!.id, a.order.team!.name])
    ).entries()
  );
  const vehicleOptions = Array.from(
    new Map(
      appointments.filter((a) => a.order.vehicle).map((a) => [a.order.vehicle!.id, a.order.vehicle!.name])
    ).entries()
  );
  const filteredAppointments = appointments.filter(
    (a) =>
      (teamFilter === "all" || a.order.team?.id === teamFilter) &&
      (vehicleFilter === "all" || a.order.vehicle?.id === vehicleFilter)
  );

  async function updateStatus(appointmentId: string, status: string) {
    await fetch(`/api/monteur/appointments/${appointmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadSchedule();
  }

  async function respondRequest(requestId: string, action: "accept" | "decline") {
    await fetch(`/api/staff-requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    loadSchedule();
    loadRequests();
  }

  async function startPause(orderId: string) {
    await fetch(`/api/monteur/orders/${orderId}/time`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startTime: new Date().toISOString(), notes: "Pause" }),
    });
  }

  async function toggleChecklist(orderId: string, checklistId: string, isChecked: boolean) {
    await fetch(`/api/monteur/orders/${orderId}/checklists`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checklistId, isChecked: !isChecked }),
    });
    loadSchedule();
  }

  async function uploadPhoto(orderId: string, file: File, category = "VORHER") {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    await fetch(`/api/monteur/orders/${orderId}/files`, { method: "POST", body: formData });
    loadSchedule();
  }

  async function completeOrder(apt: Appointment) {
    setCompletionError((prev) => ({ ...prev, [apt.id]: "" }));
    setCompletionMsg((prev) => ({ ...prev, [apt.id]: "" }));

    const checklists = apt.order.checklists ?? [];
    const checklistDone = checklists.length === 0 || checklists.every((c) => c.isChecked);
    if (!checklistDone) {
      setCompletionError((prev) => ({
        ...prev,
        [apt.id]: "Bitte zuerst alle Punkte in der Checkliste abhaken.",
      }));
      setTab(apt.id, "checklist");
      return;
    }

    if (!["IN_ARBEIT", "ABGESCHLOSSEN"].includes(apt.status)) {
      setCompletionError((prev) => ({
        ...prev,
        [apt.id]: "Bitte zuerst „Arbeit starten“ in den Details bestätigen.",
      }));
      setTab(apt.id, "details");
      return;
    }

    const res = await fetch(`/api/monteur/orders/${apt.order.id}/complete`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "ABGESCHLOSSEN",
        internalNotes: completionNotes[apt.id] ?? "",
        completionResult: "COMPLETED",
      }),
    });
    const data = await res.json();
    if (data.success) {
      setCompletionMsg((prev) => ({ ...prev, [apt.id]: "Einsatz abgeschlossen" }));
      loadSchedule();
    } else {
      setCompletionError((prev) => ({ ...prev, [apt.id]: data.error ?? "Abschluss fehlgeschlagen" }));
    }
  }

  function checklistProgress(apt: Appointment) {
    const items = apt.order.checklists ?? [];
    if (!items.length) return { done: true, label: "Keine Checkliste nötig" };
    const checked = items.filter((c) => c.isChecked).length;
    return { done: checked === items.length, label: `${checked} von ${items.length} erledigt` };
  }

  function getTab(aptId: string) {
    return activeTab[aptId] ?? "details";
  }

  function setTab(aptId: string, tab: string) {
    setActiveTab((prev) => ({ ...prev, [aptId]: tab }));
  }

  function selectDateFromWeek(date: string) {
    setSelectedDate(date);
    router.push("/monteur?view=day");
  }

  if (view === "material") {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Material mitnehmen</h1>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="mt-2 min-h-[44px] rounded-lg border border-slate-300 px-3 text-sm w-full"
          />
        </div>
        <MonteurMaterialView
          date={format(new Date(selectedDate), "EEEE, d. MMMM", { locale: de })}
          byOrder={(pickupData?.byOrder ?? []) as Parameters<typeof MonteurMaterialView>[0]["byOrder"]}
          aggregated={(pickupData?.aggregated ?? []) as Parameters<typeof MonteurMaterialView>[0]["aggregated"]}
          loading={pickupLoading}
        />
      </div>
    );
  }

  if (view === "week") {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-slate-900">Wochenplan</h1>
        <MonteurWeekCalendar
          weekStart={weekStart}
          days={weekDays}
          selectedDate={selectedDate}
          onWeekChange={setWeekStart}
          onSelectDate={selectDateFromWeek}
        />
        <Button variant="outline" className="w-full" onClick={() => router.push(`/monteur?view=material`)}>
          <Package className="h-4 w-4 mr-2" /> Material für {format(new Date(selectedDate), "dd.MM.")} anzeigen
        </Button>
        <Link href="/monteur/nachrichten" className="block text-center text-sm text-[#0d5c63] hover:underline">
          Material fehlt? → Bestellung anfordern
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          Tagesplan · {format(new Date(selectedDate), "EEEE, d. MMMM", { locale: de })}
        </h1>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="mt-2 min-h-[44px] rounded-lg border border-slate-300 px-3 text-sm w-full"
        />
      </div>

      {(teamOptions.length > 0 || vehicleOptions.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {teamOptions.length > 0 && (
            <div className="relative flex items-center">
              <Users className="absolute left-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="min-h-[40px] rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-sm"
              >
                <option value="all">Alle Teams</option>
                {teamOptions.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>
          )}
          {vehicleOptions.length > 0 && (
            <div className="relative flex items-center">
              <Car className="absolute left-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <select
                value={vehicleFilter}
                onChange={(e) => setVehicleFilter(e.target.value)}
                className="min-h-[40px] rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-sm"
              >
                <option value="all">Alle Fahrzeuge</option>
                {vehicleOptions.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>
          )}
          {(teamFilter !== "all" || vehicleFilter !== "all") && (
            <button
              type="button"
              onClick={() => { setTeamFilter("all"); setVehicleFilter("all"); }}
              className="min-h-[40px] rounded-lg px-3 text-sm text-[#0d5c63] hover:underline"
            >
              Filter zurücksetzen
            </button>
          )}
        </div>
      )}

      {staffRequests.length > 0 && (
        <Card className="!p-4 border-2 border-[#e87722]/40 bg-orange-50">
          <p className="text-sm font-semibold text-[#e87722] mb-3">Verstärkungsanfragen ({staffRequests.length})</p>
          {staffRequests.map((req) => (
            <div key={req.id} className="mb-3 last:mb-0 pb-3 last:pb-0 border-b last:border-0 border-orange-100">
              <p className="font-medium">{req.order.orderNumber} · {req.order.customer.lastName}</p>
              <p className="text-sm text-slate-600">{req.order.property.street}, {req.order.property.city}</p>
              {req.startTime && <p className="text-xs text-slate-500 mt-1">{formatDateTime(req.startTime)}</p>}
              {req.message && <p className="text-sm mt-1 italic">&quot;{req.message}&quot;</p>}
              <p className="text-xs text-slate-400">von {req.requestedBy.firstName} {req.requestedBy.lastName}</p>
              <div className="flex gap-2 mt-3">
                <Button size="touch" variant="action" onClick={() => respondRequest(req.id, "accept")}>Annehmen</Button>
                <Button size="touch" variant="outline" onClick={() => respondRequest(req.id, "decline")}>Ablehnen</Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {nextAppointment && (
        <Card className="!p-4 border-2 border-[#0d5c63]/30 bg-[#0d5c63]/5">
          <p className="text-xs font-medium text-[#0d5c63] uppercase tracking-wide mb-2">Nächster Auftrag</p>
          <p className="text-lg font-bold">{formatDateTime(nextAppointment.startTime)}</p>
          <p className="font-medium mt-1">
            {nextAppointment.order.customer.firstName} {nextAppointment.order.customer.lastName}
          </p>
          <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
            <MapPin className="h-3.5 w-3.5" />
            {nextAppointment.order.property.street}, {nextAppointment.order.property.city}
          </p>
          {(nextAppointment.order.team || nextAppointment.order.vehicle) && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {nextAppointment.order.team && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-[#0d5c63] border border-[#0d5c63]/20">
                  <Users className="h-3 w-3" /> {nextAppointment.order.team.name}
                </span>
              )}
              {nextAppointment.order.vehicle && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
                  <Car className="h-3 w-3" /> {nextAppointment.order.vehicle.name}
                  {nextAppointment.order.vehicle.licensePlate ? ` · ${nextAppointment.order.vehicle.licensePlate}` : ""}
                </span>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-4">
            {nextAppointment.order.customer.phone && (
              <a href={`tel:${nextAppointment.order.customer.phone}`}>
                <Button size="touch" variant="outline"><Phone className="h-4 w-4 mr-1" /> Anrufen</Button>
              </a>
            )}
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(`${nextAppointment.order.property.street}, ${nextAppointment.order.property.zipCode} ${nextAppointment.order.property.city}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button size="touch" variant="action"><Navigation className="h-4 w-4 mr-1" /> Navigation</Button>
            </a>
          </div>
        </Card>
      )}

      {filteredAppointments.length === 0 ? (
        <Card><p className="text-center text-slate-500 py-8">
          {appointments.length === 0 ? "Keine Termine an diesem Tag." : "Keine Termine für die gewählten Filter."}
        </p></Card>
      ) : (
        filteredAppointments.map((apt) => (
          <Card key={apt.id} className="!p-0 overflow-hidden">
            <button
              type="button"
              className="w-full p-4 text-left"
              onClick={() => setExpandedId(expandedId === apt.id ? null : apt.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{formatDateTime(apt.startTime)}</p>
                  <p className="text-sm text-slate-600">{apt.order.customer.firstName} {apt.order.customer.lastName}</p>
                  <p className="text-xs text-slate-400">{apt.order.services.map((s) => s.service?.name ?? s.customName ?? "Sonstige Leistung").join(", ")}</p>
                  {(apt.order.team || apt.order.vehicle) && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {apt.order.team && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#0d5c63]/10 px-2 py-0.5 text-[11px] font-medium text-[#0d5c63]">
                          <Users className="h-3 w-3" /> {apt.order.team.name}
                        </span>
                      )}
                      {apt.order.vehicle && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          <Car className="h-3 w-3" /> {apt.order.vehicle.name}
                          {apt.order.vehicle.licensePlate ? ` · ${apt.order.vehicle.licensePlate}` : ""}
                        </span>
                      )}
                    </div>
                  )}
                  {(() => {
                    const cp = getCurrentPhase(apt.order.phases);
                    return cp ? (
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Layers className="h-3 w-3 shrink-0" /> Phase: {cp.name}
                      </p>
                    ) : null;
                  })()}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge status={apt.status} label={APPOINTMENT_STATUS_LABELS[apt.status] ?? apt.status} />
                  {(() => {
                    const cp = getCurrentPhase(apt.order.phases);
                    return cp ? (
                      <Badge
                        status={PHASE_STATUS_BADGE[cp.status] ?? "DRAFT"}
                        label={PHASE_STATUS_LABELS[cp.status] ?? cp.status}
                      />
                    ) : null;
                  })()}
                </div>
              </div>
            </button>

            {expandedId === apt.id && (
              <div className="border-t border-slate-100">
                <div className="flex overflow-x-auto border-b border-slate-100 bg-slate-50/50">
                  {["details", "material", "checklist", "fotos", "abschluss"].map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setTab(apt.id, tab)}
                      className={`px-4 py-3 text-sm font-medium whitespace-nowrap min-h-[44px] transition-colors ${
                        getTab(apt.id) === tab ? TAB_ACTIVE : TAB_INACTIVE
                      }`}
                    >
                      {tab === "details" ? "Details" : tab === "material" ? "Material" : tab === "checklist" ? "Checkliste" : tab === "fotos" ? "Fotos" : "Abschluss"}
                    </button>
                  ))}
                </div>

                <div className="p-4 space-y-4">
                  {getTab(apt.id) === "details" && (
                    <>
                      <p className="text-sm text-slate-600 flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {apt.order.property.street}, {apt.order.property.city}
                      </p>
                      {apt.order.description && <p className="text-sm">{apt.order.description}</p>}
                      <div className="grid grid-cols-2 gap-2">
                        {STATUS_ACTIONS.map(({ status, label, icon: Icon, variant }) => {
                          const isActive = apt.status === status;
                          const isPast = STATUS_ACTIONS.findIndex((s) => s.status === apt.status) > STATUS_ACTIONS.findIndex((s) => s.status === status);
                          return (
                            <Button
                              key={status}
                              size="touch"
                              variant={isActive ? "action" : variant}
                              disabled={isPast && !isActive}
                              onClick={(e) => { e.stopPropagation(); updateStatus(apt.id, status); }}
                              className="w-full"
                            >
                              <Icon className="h-4 w-4 mr-1" /> {label}
                            </Button>
                          );
                        })}
                        <Button size="touch" variant="outline" onClick={(e) => { e.stopPropagation(); startPause(apt.order.id); }} className="col-span-2">
                          <Pause className="h-4 w-4 mr-1" /> Pause erfassen
                        </Button>
                      </div>
                      {["IN_ARBEIT", "ABGESCHLOSSEN"].includes(apt.status) && (
                        <Button
                          size="touch"
                          variant="action"
                          className="w-full"
                          onClick={(e) => { e.stopPropagation(); setTab(apt.id, "abschluss"); }}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" /> Weiter zum Abschluss
                        </Button>
                      )}

                      {(apt.order.phases ?? []).filter((p) => p.isEnabled).length > 0 && (
                        <div className="pt-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1">
                            <Layers className="h-3.5 w-3.5" /> Phasen
                          </p>
                          <div className="space-y-2">
                            {(apt.order.phases ?? [])
                              .filter((p) => p.isEnabled)
                              .map((p) => {
                                const assignee = phaseAssigneeLabel(p);
                                return (
                                  <div key={p.id} className="rounded-lg border border-slate-100 p-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-sm font-medium text-slate-700">{p.name}</span>
                                      <Badge
                                        status={PHASE_STATUS_BADGE[p.status] ?? "DRAFT"}
                                        label={PHASE_STATUS_LABELS[p.status] ?? p.status}
                                      />
                                    </div>
                                    {assignee && (
                                      <p className="text-xs text-slate-500 mt-1">Zuständig: {assignee}</p>
                                    )}
                                    {p.specialNotes && (
                                      <p className="text-xs text-amber-700 mt-1">Besonderheit: {p.specialNotes}</p>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {getTab(apt.id) === "material" && (
                    <div className="space-y-2">
                      {(apt.order.materialLines ?? []).length === 0 ? (
                        <p className="text-sm text-slate-500">Keine Packliste.</p>
                      ) : (
                        apt.order.materialLines!.map((line) => {
                          const reserved = line.reservations?.some((r) =>
                            ["VORGESCHLAGEN", "RESERVIERT"].includes(r.status)
                          );
                          const pickup = calcPickupWithReserve(line.quantityRequired, line.isTool);
                          return (
                            <div key={line.id} className="flex justify-between gap-2 text-sm py-2 border-b border-slate-50 last:border-0">
                              <div>
                                <p className="font-medium">{line.name}{line.isTool ? " (Werkzeug)" : ""}</p>
                                <p className="text-xs text-slate-500">
                                  {line.quantityRequired} {line.unit} → mitnehmen: <strong>{pickup} {line.unit}</strong>
                                </p>
                                {line.reservations?.[0]?.storageLocation?.name && (
                                  <p className="text-xs text-slate-400">Lager: {line.reservations[0].storageLocation.name}</p>
                                )}
                              </div>
                              {reserved ? (
                                <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full h-fit">Reserviert</span>
                              ) : (
                                <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full h-fit">Offen</span>
                              )}
                            </div>
                          );
                        })
                      )}
                      <Link href={`/monteur/auftrag/${apt.order.id}`} className="text-sm text-[#0d5c63] underline block mt-2">
                        Verbrauch buchen →
                      </Link>
                    </div>
                  )}

                  {getTab(apt.id) === "checklist" && (
                    apt.order.checklists.length > 0 ? apt.order.checklists.map((item) => (
                      <label key={item.id} className="flex items-center gap-3 min-h-[44px]">
                        <input
                          type="checkbox"
                          checked={item.isChecked}
                          onChange={() => toggleChecklist(apt.order.id, item.id, item.isChecked)}
                          className="h-5 w-5"
                        />
                        <span className={item.isChecked ? "line-through text-slate-400" : ""}>{item.label}</span>
                      </label>
                    )) : <p className="text-sm text-slate-500">Keine Checkliste vorhanden.</p>
                  )}

                  {getTab(apt.id) === "fotos" && (
                    <div className="space-y-3">
                      <label className="flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 p-4">
                        <Camera className="h-5 w-5" /> Vorher-Foto
                        <input type="file" accept="image/*" capture="environment" className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(apt.order.id, f, "VORHER"); }} />
                      </label>
                      <label className="flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 p-4">
                        <Camera className="h-5 w-5" /> Nachher-Foto
                        <input type="file" accept="image/*" capture="environment" className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(apt.order.id, f, "NACHHER"); }} />
                      </label>
                    </div>
                  )}

                  {getTab(apt.id) === "abschluss" && (() => {
                    const progress = checklistProgress(apt);
                    const readyForComplete = ["IN_ARBEIT", "ABGESCHLOSSEN"].includes(apt.status) && progress.done;
                    const isDone = apt.status === "ABGESCHLOSSEN" || apt.order.status === "ABRECHNUNGSBEREIT";
                    return (
                      <div className="space-y-4">
                        <p className="text-sm font-medium text-slate-700">Abschluss in 3 Schritten</p>
                        <ol className="space-y-2 text-sm">
                          <li className={`flex items-start gap-2 ${["IN_ARBEIT", "ABGESCHLOSSEN"].includes(apt.status) ? "text-green-700" : "text-slate-500"}`}>
                            <span className="font-semibold shrink-0">1.</span>
                            <span>Arbeit gestartet {["IN_ARBEIT", "ABGESCHLOSSEN"].includes(apt.status) ? "✓" : "– in Details bestätigen"}</span>
                          </li>
                          <li className={`flex items-start gap-2 ${progress.done ? "text-green-700" : "text-slate-500"}`}>
                            <span className="font-semibold shrink-0">2.</span>
                            <span>
                              Checkliste ({progress.label})
                              {!progress.done && (
                                <button type="button" className="ml-2 text-[#0d5c63] underline" onClick={() => setTab(apt.id, "checklist")}>
                                  öffnen
                                </button>
                              )}
                            </span>
                          </li>
                          <li className="flex items-start gap-2 text-slate-600">
                            <span className="font-semibold shrink-0">3.</span>
                            <span>
                              Optional:{" "}
                              <button type="button" className="text-[#0d5c63] underline" onClick={() => setTab(apt.id, "fotos")}>Fotos</button>
                              {" · "}
                              <Link href={`/monteur/auftrag/${apt.order.id}`} className="text-[#0d5c63] underline">
                                Verbrauch buchen
                              </Link>
                            </span>
                          </li>
                        </ol>

                        {!isDone && (
                          <>
                            <textarea
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[88px]"
                              placeholder="Abschlussnotizen (optional)..."
                              value={completionNotes[apt.id] ?? ""}
                              onChange={(e) => setCompletionNotes((prev) => ({ ...prev, [apt.id]: e.target.value }))}
                            />
                            {completionError[apt.id] && (
                              <p className="text-sm text-red-600">{completionError[apt.id]}</p>
                            )}
                            {completionMsg[apt.id] && (
                              <p className="text-sm text-green-700">{completionMsg[apt.id]}</p>
                            )}
                            <Button
                              size="touch"
                              variant="action"
                              className="w-full"
                              disabled={!readyForComplete}
                              onClick={() => completeOrder(apt)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" /> Einsatz abschließen
                            </Button>
                            {!readyForComplete && (
                              <p className="text-xs text-slate-500 text-center">
                                Schritte 1 und 2 müssen erledigt sein.
                              </p>
                            )}
                          </>
                        )}
                        {isDone && (
                          <p className="text-sm text-green-700 text-center font-medium">
                            Abgeschlossen – Auftrag ist abrechnungsbereit.
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </Card>
        ))
      )}

      <p className="text-xs text-center text-slate-400 py-2">
        Änderungen werden automatisch synchronisiert
      </p>
    </div>
  );
}

export default function MonteurPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Laden...</p>}>
      <MonteurPageContent />
    </Suspense>
  );
}
