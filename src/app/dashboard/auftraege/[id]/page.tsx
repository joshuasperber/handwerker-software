"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABELS, PRIORITY_LABELS, PRIORITY_COLORS, formatDateTime, isOverdue } from "@/lib/utils";
import { MATERIAL_STATUS_LABELS } from "@/lib/inventory/formulas";
import { MapPin, Phone, Mail, Clock, CheckSquare, Upload, Calculator, Users, CheckCircle, History, ExternalLink } from "lucide-react";
import { PlanViewer } from "@/components/orders/plan-viewer";
import { PhotoGallery } from "@/components/orders/photo-gallery";
import { OrderBillingSection } from "@/components/orders/billing-section";
import { OrderPhases, type OrderPhaseData } from "@/components/orders/order-phases";
import { OrderSharePanel } from "@/components/orders/order-share-panel";
import { usePermission } from "@/components/auth/can-access";
import { fetchJson } from "@/lib/fetch-json";
import { saveJson } from "@/lib/save-toast";
import { CanAccess } from "@/components/auth/can-access";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";

const STATUS_FLOW = ORDER_STATUS_FLOW;

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  priority: string;
  description: string | null;
  internalNotes: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  customer: { firstName: string; lastName: string; email: string; phone: string | null };
  property: { street: string; zipCode: string; city: string };
  services: {
    service: { name: string; durationMinutes: number } | null;
    customName?: string | null;
    description?: string | null;
    quantity?: number;
    unitPriceCents?: number | null;
  }[];
  appointments: {
    id: string;
    startTime: string;
    endTime: string;
    employee: { user: { firstName: string; lastName: string } } | null;
  }[];
  checklists: { id: string; label: string; isChecked: boolean }[];
  files: { id: string; fileName: string; category: string }[];
  timeEntries: { startTime: string; endTime: string | null; breakMinutes: number }[];
  materialUsages: { name: string; quantity: number; unit: string }[];
  title?: string | null;
  materialStatus?: string;
  phases?: OrderPhaseData[];
  materialLines?: {
    id: string;
    name: string;
    quantityRequired: number;
    unit: string;
    lineStatus: string;
    isTool: boolean;
    reservations?: { status: string; quantity: number; storageLocation?: { name: string } }[];
  }[];
  team?: { id: string; name: string; members: { employee: { user: { firstName: string; lastName: string } } }[] } | null;
  vehicle?: { id: string; name: string; licensePlate: string | null } | null;
}

export default function AuftragDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const canEditPhases = usePermission("orders.write");
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [notes, setNotes] = useState("");
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [vehicles, setVehicles] = useState<{ id: string; name: string }[]>([]);
  const [plans, setPlans] = useState<{ id: string; fileName: string; url: string | null; planMarkers: { id: string; markerType: string; label: string | null; posX: number; posY: number }[] }[]>([]);
  const [allEmployees, setAllEmployees] = useState<{
    id: string;
    assignmentStatus: "available" | "busy";
    user: { firstName: string; lastName: string; role: string };
  }[]>([]);
  const [staffPick, setStaffPick] = useState<string[]>([]);
  const [staffMessage, setStaffMessage] = useState("");
  const [staffError, setStaffError] = useState("");
  const [staffRequests, setStaffRequests] = useState<{ id: string; status: string; employee: { user: { firstName: string; lastName: string } } }[]>([]);
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [assignStart, setAssignStart] = useState("");
  const [assignEnd, setAssignEnd] = useState("");
  const [assignError, setAssignError] = useState("");
  const [availabilityWarning, setAvailabilityWarning] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [calculation, setCalculation] = useState<{ id: string; title: string | null; netSalesPrice: number } | null>(null);
  const [timeline, setTimeline] = useState<{ id: string; at: string; label: string; detail?: string; user?: string }[]>([]);

  const loadOrder = useCallback(() => {
    if (!id || typeof id !== "string") return;

    fetchJson<OrderDetail>(`/api/orders/${id}`).then((data) => {
      if (data.success && data.data) {
        setOrder(data.data);
        setNotes(data.data.internalNotes ?? "");
        if (data.data.scheduledStart) {
          setAssignStart((prev) => prev || data.data!.scheduledStart!.slice(0, 16));
        }
        if (data.data.scheduledEnd) {
          setAssignEnd((prev) => prev || data.data!.scheduledEnd!.slice(0, 16));
        }
      }
    });

    fetchJson<typeof plans>(`/api/orders/${id}/plans`).then((d) => {
      if (d.success && d.data) setPlans(d.data);
    });

    fetchJson<typeof staffRequests>(`/api/staff-requests?orderId=${id}`).then((d) => {
      if (d.success && d.data) setStaffRequests(d.data);
    });
  }, [id]);

  useEffect(() => {
    loadOrder();
    fetchJson("/api/teams").then((d) => { if (d.success && d.data) setTeams(d.data as typeof teams); });
    fetchJson("/api/vehicles").then((d) => { if (d.success && d.data) setVehicles(d.data as typeof vehicles); });
    fetchJson<typeof allEmployees>(`/api/orders/${id}/assignable-employees`).then((d) => {
      if (d.success && d.data) setAllEmployees(d.data);
    });
    fetchJson<{ calculation: typeof calculation }>(`/api/orders/${id}/calculation`).then((d) => {
      if (d.success && d.data?.calculation) setCalculation(d.data.calculation);
    });
    fetchJson<{ timeline: typeof timeline }>(`/api/orders/${id}/history`).then((d) => {
      if (d.success && d.data?.timeline) setTimeline(d.data.timeline);
    });
  }, [loadOrder, id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!assignEmployeeId || !assignStart || !assignEnd || !id) {
        setAvailabilityWarning("");
        return;
      }
      const params = new URLSearchParams({
        employeeId: assignEmployeeId,
        startTime: new Date(assignStart).toISOString(),
        endTime: new Date(assignEnd).toISOString(),
      });
      fetchJson<{ available: boolean; conflict?: { message: string } }>(
        `/api/orders/${id}/availability?${params}`
      ).then((d) => {
        if (d.success && d.data?.conflict) setAvailabilityWarning(d.data.conflict.message);
        else setAvailabilityWarning("");
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [assignEmployeeId, assignStart, assignEnd, id]);

  async function updatePriority(priority: string) {
    await saveJson(
      `/api/orders/${id}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ priority }) },
      { success: "Priorität aktualisiert" }
    );
    loadOrder();
  }

  async function updateStatus(status: string) {
    await saveJson(
      `/api/orders/${id}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) },
      { success: "Status aktualisiert" }
    );
    loadOrder();
  }

  async function saveNotes() {
    await saveJson(
      `/api/orders/${id}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ internalNotes: notes }) },
      { success: "Notiz gespeichert" }
    );
  }

  async function reserveMaterial() {
    await saveJson(
      "/api/reservations",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: id }) },
      { success: "Material reserviert" }
    );
    loadOrder();
  }

  async function assignTeam(teamId: string) {
    await saveJson(
      `/api/orders/${id}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId: teamId || null }) },
      { success: "Team zugewiesen" }
    );
    loadOrder();
  }

  async function assignVehicle(vehicleId: string) {
    await saveJson(
      `/api/orders/${id}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vehicleId: vehicleId || null }) },
      { success: "Fahrzeug zugewiesen" }
    );
    loadOrder();
  }

  async function sendStaffRequest() {
    if (!staffPick.length) return;
    setStaffError("");
    const res = await fetch("/api/staff-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: id,
        employeeIds: staffPick,
        message: staffMessage,
        startTime: assignStart ? new Date(assignStart).toISOString() : order?.scheduledStart,
        endTime: assignEnd ? new Date(assignEnd).toISOString() : order?.scheduledEnd,
      }),
    });
    const data = await res.json();
    if (data.success) {
      setStaffPick([]);
      setStaffMessage("");
      if (data.data?.skipped?.length) {
        setStaffError(`${data.data.count} Anfrage(n) gesendet. Einige Auswahlen wurden übersprungen.`);
      }
      loadOrder();
      fetchJson<typeof staffRequests>(`/api/staff-requests?orderId=${id}`).then((d) => {
        if (d.success && d.data) setStaffRequests(d.data);
      });
    } else {
      setStaffError(data.error ?? "Anfrage fehlgeschlagen");
    }
  }

  async function cancelStaffRequest(requestId: string) {
    await fetch(`/api/staff-requests/${requestId}`, { method: "DELETE" });
    loadOrder();
    fetchJson<typeof staffRequests>(`/api/staff-requests?orderId=${id}`).then((d) => {
      if (d.success && d.data) setStaffRequests(d.data);
    });
  }

  async function assignEmployee() {
    setAssignError("");
    if (!assignEmployeeId || !assignStart || !assignEnd) {
      setAssignError("Mitarbeiter, Start und Ende auswählen");
      return;
    }
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: id,
        employeeId: assignEmployeeId,
        startTime: new Date(assignStart).toISOString(),
        endTime: new Date(assignEnd).toISOString(),
      }),
    });
    const data = await res.json();
    if (data.success) {
      setAssignEmployeeId("");
      loadOrder();
      fetchJson<{ timeline: typeof timeline }>(`/api/orders/${id}/history`).then((d) => {
        if (d.success && d.data?.timeline) setTimeline(d.data.timeline);
      });
    } else {
      setAssignError(data.error ?? "Termin konnte nicht angelegt werden");
    }
  }

  async function createCalculation() {
    setActionMsg("");
    if (calculation?.id) {
      router.push(`/dashboard/kalkulation/${calculation.id}`);
      return;
    }
    const res = await fetch(`/api/orders/${id}/calculation`, { method: "POST" });
    const data = await res.json();
    if (data.success && data.data?.calculation?.id) {
      setCalculation(data.data.calculation);
      router.push(`/dashboard/kalkulation/${data.data.calculation.id}`);
    } else {
      setActionMsg(data.error ?? "Kalkulation fehlgeschlagen");
    }
  }

  async function planTeamInCalendar() {
    setActionMsg("");
    if (!assignStart || !assignEnd) {
      setActionMsg("Bitte zuerst Von/Bis unter „Mitarbeiter zuweisen“ setzen und speichern (Termin anlegen).");
      return;
    }
    const res = await fetch(`/api/orders/${id}/team-appointments`, { method: "POST" });
    const data = await res.json();
    if (data.success) {
      let msg = `${data.data.created} Termin(e) im Kalender angelegt`;
      if (data.data.conflicts?.length) {
        msg += `. Konflikte: ${data.data.conflicts.join("; ")}`;
      }
      setActionMsg(msg);
      loadOrder();
      fetchJson<{ timeline: typeof timeline }>(`/api/orders/${id}/history`).then((d) => {
        if (d.success && d.data?.timeline) setTimeline(d.data.timeline);
      });
    } else {
      setActionMsg(data.error ?? "Team-Einplanung fehlgeschlagen");
    }
  }

  async function completeOrderOffice() {
    setCompleting(true);
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ABRECHNUNGSBEREIT", completionResult: "COMPLETED" }),
    });
    setCompleting(false);
    setConfirmComplete(false);
    if (res.ok) {
      toast.success("Auftrag abgeschlossen", {
        description: "Der Auftrag ist jetzt abrechnungsbereit – Sie können die Rechnung erstellen.",
      });
      loadOrder();
    } else {
      toast.error("Abschluss fehlgeschlagen", {
        description: "Bitte versuchen Sie es erneut.",
      });
    }
  }

  async function uploadPlan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", "PLAN");
    await fetch(`/api/orders/${id}/files`, { method: "POST", body: fd });
    loadOrder();
  }

  if (!order) return <div className="text-slate-500">Laden...</div>;

  return (
    <div>
      <ConfirmDialog
        open={confirmComplete}
        onOpenChange={setConfirmComplete}
        title="Auftrag abschließen?"
        description="Der Auftrag wird als erledigt markiert und auf „abrechnungsbereit“ gesetzt. Anschließend können Sie die Rechnung erstellen."
        confirmLabel="Auftrag abschließen"
        icon={<CheckCircle className="h-5 w-5" />}
        loading={completing}
        onConfirm={completeOrderOffice}
      />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{order.title ?? order.orderNumber}</h1>
          <p className="text-sm text-slate-400">{order.orderNumber}</p>
          {isOverdue(order.scheduledStart, order.status) && (
            <Badge status="UEBERFAELLIG" label="Überfällig" className="mt-2 mr-2" />
          )}
          <Badge status={order.status} label={ORDER_STATUS_LABELS[order.status]} className="mt-2" />
          <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[order.priority]}`}>
            {PRIORITY_LABELS[order.priority]}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <CanAccess permission="calculations.write">
            {calculation ? (
              <Link href={`/dashboard/kalkulation/${calculation.id}`}>
                <Button size="sm" variant="outline">
                  <ExternalLink className="h-4 w-4 mr-1" /> Zur Kalkulation
                </Button>
              </Link>
            ) : (
              <Button size="sm" variant="outline" onClick={createCalculation}>
                <Calculator className="h-4 w-4 mr-1" /> Grundkalkulation
              </Button>
            )}
          </CanAccess>
          <CanAccess permission="orders.assign">
            {order.team && (
              <Button
                size="sm"
                variant="outline"
                onClick={planTeamInCalendar}
                disabled={!order.scheduledStart && !assignStart}
                title={!order.scheduledStart && !assignStart ? "Zuerst Terminzeiten setzen" : undefined}
              >
                <Users className="h-4 w-4 mr-1" /> Team in Kalender
              </Button>
            )}
          </CanAccess>
          <CanAccess permission="orders.write">
            {!["ABRECHNUNGSBEREIT", "ABGERECHNET", "STORNIERT"].includes(order.status) && (
              <Button size="sm" variant="action" onClick={() => setConfirmComplete(true)}>
                <CheckCircle className="h-4 w-4 mr-1" /> Abschließen
              </Button>
            )}
            <select
              value={order.priority}
              onChange={(e) => updatePriority(e.target.value)}
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            >
              {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={order.status}
              onChange={(e) => updateStatus(e.target.value)}
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            >
              {STATUS_FLOW.map((s) => (
                <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </CanAccess>
        </div>
      </div>
      {actionMsg && <p className="text-sm text-slate-600 mb-4">{actionMsg}</p>}

      <CanAccess permission="calculations.read">
        <OrderBillingSection
          orderId={order.id}
          orderStatus={order.status}
          calculationId={calculation?.id ?? null}
          onCreateCalculation={createCalculation}
          onInvoiceCreated={loadOrder}
        />
      </CanAccess>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Kunde & Einsatzort">
            <div className="space-y-3">
              <p className="font-medium">{order.customer.firstName} {order.customer.lastName}</p>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Mail className="h-4 w-4" /> {order.customer.email}
              </div>
              {order.customer.phone && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Phone className="h-4 w-4" /> {order.customer.phone}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <MapPin className="h-4 w-4" />
                {order.property.street}, {order.property.zipCode} {order.property.city}
              </div>
            </div>
          </Card>

          <Card title="Leistungen">
            {order.services.map((s, i) => (
              <div key={i} className="flex justify-between py-2 border-b border-slate-50 last:border-0">
                <span>
                  {s.service?.name ?? s.customName ?? "Sonstige Leistung"}
                  {!s.service && <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-600">sonstige</span>}
                  {s.description && <span className="block text-xs text-slate-400">{s.description}</span>}
                </span>
                <span className="text-slate-400">
                  {s.service ? `${s.service.durationMinutes} Min.` : s.unitPriceCents != null ? `${(s.unitPriceCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}` : `${s.quantity ?? 1}×`}
                </span>
              </div>
            ))}
            {order.description && (
              <p className="mt-3 text-sm text-slate-600">{order.description}</p>
            )}
          </Card>

          <OrderPhases
            orderId={order.id}
            phases={order.phases ?? []}
            teams={teams}
            employees={allEmployees}
            canEdit={canEditPhases}
            onChanged={loadOrder}
          />

          <Card title="Fotos & Dokumentation">
            <p className="text-xs text-slate-500 -mt-1 mb-1">
              Fotos von Aufmaß, Baustelle, Wohnung, Schäden, Montage etc. – optional einer Phase zugeordnet.
            </p>
            <PhotoGallery
              baseUrl={`/api/orders/${order.id}/files`}
              canUpload={canEditPhases}
              canDelete={canEditPhases}
              phases={(order.phases ?? []).map((p) => ({ id: p.id, name: p.name }))}
              onChanged={loadOrder}
            />
          </Card>

          {order.materialLines && order.materialLines.length > 0 && (
            <Card title="Packliste / Material">
              <p className="text-xs text-slate-400 mb-2">
                Materialstatus: {MATERIAL_STATUS_LABELS[order.materialStatus ?? "NOT_CHECKED"] ?? order.materialStatus}
              </p>
              {order.materialLines.map((m) => {
                const reserved = m.reservations?.some((r) =>
                  ["VORGESCHLAGEN", "RESERVIERT"].includes(r.status)
                );
                const loc = m.reservations?.find((r) =>
                  ["VORGESCHLAGEN", "RESERVIERT"].includes(r.status)
                )?.storageLocation?.name;
                return (
                <div key={m.id} className="flex justify-between items-center gap-2 py-2 border-b border-slate-50 last:border-0 text-sm">
                  <span>{m.name}{m.isTool ? " (Werkzeug)" : ""}{loc ? ` · ${loc}` : ""}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-slate-500">{m.quantityRequired} {m.unit}</span>
                    {reserved ? (
                      <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Reserviert</span>
                    ) : (
                      <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Offen</span>
                    )}
                  </div>
                </div>
                );
              })}
              <CanAccess permission="inventory.reserve">
                <Button size="sm" className="mt-3" variant="outline" onClick={reserveMaterial}>
                  Material reservieren
                </Button>
              </CanAccess>
            </Card>
          )}

          {order.checklists.length > 0 && (
            <Card title="Checkliste">
              {order.checklists.map((item) => (
                <label key={item.id} className="flex items-center gap-2 py-2">
                  <CheckSquare className={`h-4 w-4 ${item.isChecked ? "text-green-600" : "text-slate-300"}`} />
                  <span className={item.isChecked ? "line-through text-slate-400" : ""}>{item.label}</span>
                </label>
              ))}
            </Card>
          )}

          <CanAccess permission="orders.write">
          <Card title="Interne Notizen">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            <Button size="sm" className="mt-2" onClick={saveNotes}>Speichern</Button>
          </Card>

          <Card title="Pläne & Markierungen">
            <label className="flex items-center gap-2 text-sm text-[#0d5c63] cursor-pointer mb-4">
              <Upload className="h-4 w-4" />
              Plan hochladen (PDF/Bild)
              <input type="file" accept="image/*,.pdf" className="hidden" onChange={uploadPlan} />
            </label>
            {plans.map((p) => (
              <div key={p.id} className="mb-6 last:mb-0">
                <p className="text-sm font-medium mb-2">{p.fileName}</p>
                <PlanViewer
                  orderId={id as string}
                  fileId={p.id}
                  imageUrl={p.url}
                  markers={p.planMarkers}
                  onMarkerAdded={loadOrder}
                />
              </div>
            ))}
            {!plans.length && (
              <p className="text-sm text-slate-500">Noch kein Plan hochgeladen. KI-Analyse folgt später.</p>
            )}
          </Card>
          </CanAccess>
        </div>

        <div className="space-y-6">
          <CanAccess permission="orders.assign">
          <Card title="Mitarbeiter zuweisen">
            <p className="text-xs text-slate-500 mb-3">
              Wählen Sie Mitarbeiter und Termin – der Eintrag erscheint im Team-Kalender unter Termine.
            </p>
            {assignError && <p className="text-sm text-red-600 mb-2">{assignError}</p>}
            {availabilityWarning && (
              <p className="text-sm text-amber-700 mb-2">⚠ {availabilityWarning}</p>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500">Mitarbeiter</label>
                <select
                  className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
                  value={assignEmployeeId}
                  onChange={(e) => setAssignEmployeeId(e.target.value)}
                >
                  <option value="">— Mitarbeiter wählen —</option>
                  {allEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id} disabled={emp.assignmentStatus === "busy"}>
                      {emp.user.firstName} {emp.user.lastName}
                      {emp.assignmentStatus === "busy" ? " (bereits eingeplant)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Von</label>
                <input
                  type="datetime-local"
                  className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
                  value={assignStart}
                  onChange={(e) => setAssignStart(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Bis</label>
                <input
                  type="datetime-local"
                  className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
                  value={assignEnd}
                  onChange={(e) => setAssignEnd(e.target.value)}
                />
              </div>
              <Button size="sm" onClick={assignEmployee} disabled={!assignEmployeeId || !assignStart || !assignEnd}>
                Termin anlegen
              </Button>
            </div>
          </Card>

          <Card title="Disposition">
            {order.team && !order.scheduledStart && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3 mb-3">
                Team „{order.team.name}“ ist zugewiesen, aber es fehlen Terminzeiten (Von/Bis).
                Legen Sie zuerst einen Termin an – dann können alle Teammitglieder in den Kalender eingeplant werden.
              </p>
            )}
            <p className="text-xs text-slate-500 mb-3">
              Team zuweisen + Termin (Von/Bis) setzen → alle Teammitglieder erhalten automatisch einen Kalendereintrag.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500">Team</label>
                <select
                  className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
                  value={order.team?.id ?? ""}
                  onChange={(e) => assignTeam(e.target.value)}
                >
                  <option value="">— Kein Team —</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {order.team && (
                  <p className="text-xs text-slate-400 mt-1">
                    {order.team.members.map((m) => `${m.employee.user.firstName} ${m.employee.user.lastName}`).join(", ")}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs text-slate-500">Fahrzeug</label>
                <select
                  className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
                  value={order.vehicle?.id ?? ""}
                  onChange={(e) => assignVehicle(e.target.value)}
                >
                  <option value="">— Kein Fahrzeug —</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          <Card title="Verstärkung anfragen (optional)">
            <p className="text-xs text-slate-500 mb-3">
              Nur Monteure/Meister, die noch nicht eingeplant sind. Sie können sich nicht selbst anfragen.
              Terminzeit wird aus Von/Bis oben übernommen.
            </p>
            {staffError && <p className="text-sm text-amber-700 mb-2">{staffError}</p>}
            <div className="flex flex-wrap gap-2 mb-3">
              {allEmployees.map((emp) => {
                const disabled = emp.assignmentStatus === "busy";
                return (
                  <label
                    key={emp.id}
                    className={`text-sm px-3 py-1.5 rounded-lg border ${
                      disabled ? "opacity-40 cursor-not-allowed border-slate-100" :
                      staffPick.includes(emp.id) ? "border-[#0d5c63] bg-[#0d5c63]/5 cursor-pointer" : "border-slate-200 cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mr-2"
                      disabled={disabled}
                      checked={staffPick.includes(emp.id)}
                      onChange={() => !disabled && setStaffPick((p) => p.includes(emp.id) ? p.filter((x) => x !== emp.id) : [...p, emp.id])}
                    />
                    {emp.user.firstName} {emp.user.lastName}
                    {disabled && " ✓"}
                  </label>
                );
              })}
              {!allEmployees.filter((e) => e.assignmentStatus === "available").length && (
                <p className="text-sm text-slate-500">Alle Monteure sind bereits eingeplant oder angefragt.</p>
              )}
            </div>
            <Textarea value={staffMessage} onChange={(e) => setStaffMessage(e.target.value)} placeholder="Kurze Nachricht (optional)" rows={2} />
            <Button size="sm" className="mt-2" onClick={sendStaffRequest} disabled={!staffPick.length}>Anfrage senden</Button>
            {staffRequests.filter((r) => r.status === "PENDING").length > 0 && (
              <ul className="mt-3 text-sm text-amber-700 space-y-1">
                {staffRequests.filter((r) => r.status === "PENDING").map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span>⏳ {r.employee.user.firstName} {r.employee.user.lastName} – ausstehend</span>
                    <button type="button" className="text-xs text-slate-500 hover:text-red-600" onClick={() => cancelStaffRequest(r.id)}>Zurückziehen</button>
                  </li>
                ))}
              </ul>
            )}
            {staffRequests.filter((r) => r.status === "ACCEPTED").length > 0 && (
              <ul className="mt-2 text-sm text-green-700">
                {staffRequests.filter((r) => r.status === "ACCEPTED").map((r) => (
                  <li key={r.id}>✓ {r.employee.user.firstName} {r.employee.user.lastName} – zugesagt</li>
                ))}
              </ul>
            )}
          </Card>
          </CanAccess>

          <CanAccess permission="orders.write">
            <OrderSharePanel orderId={order.id} />
          </CanAccess>

          <Card title="Termine">
            {order.appointments.map((apt) => (
              <div key={apt.id} className="py-2 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-slate-400" />
                  {formatDateTime(apt.startTime)}
                </div>
                {apt.employee && (
                  <p className="text-xs text-slate-400 mt-1 ml-6">
                    {apt.employee.user.firstName} {apt.employee.user.lastName}
                  </p>
                )}
              </div>
            ))}
            {!order.appointments.length && (
              <p className="text-sm text-slate-500">Kein Termin geplant</p>
            )}
          </Card>

          {order.timeEntries.length > 0 && (
            <Card title="Arbeitszeit">
              {order.timeEntries.map((t, i) => (
                <p key={i} className="text-sm py-1">
                  {formatDateTime(t.startTime)}
                  {t.endTime ? ` – ${formatDateTime(t.endTime)}` : " (läuft)"}
                </p>
              ))}
            </Card>
          )}

          {order.materialUsages.length > 0 && (
            <Card title="Material">
              {order.materialUsages.map((m, i) => (
                <p key={i} className="text-sm py-1">{m.name}: {m.quantity} {m.unit}</p>
              ))}
            </Card>
          )}

          <Card title="Verlauf & Zuweisungen">
            <p className="text-xs text-slate-500 mb-3 flex items-center gap-1">
              <History className="h-3.5 w-3.5" /> Wer hat wann was geplant oder geändert?
            </p>
            {timeline.length > 0 ? (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {timeline.map((entry) => (
                  <li key={entry.id} className="text-sm border-b border-slate-50 pb-2 last:border-0">
                    <p className="font-medium">{entry.label}</p>
                    {entry.detail && <p className="text-slate-600 text-xs">{entry.detail}</p>}
                    <p className="text-slate-400 text-xs mt-0.5">
                      {formatDateTime(entry.at)}
                      {entry.user ? ` · ${entry.user}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Noch keine Einträge.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
