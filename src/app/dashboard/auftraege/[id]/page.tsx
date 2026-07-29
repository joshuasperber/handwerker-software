"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatEuro, ROLE_LABELS } from "@/lib/utils";
import { MATERIAL_STATUS_LABELS } from "@/lib/inventory/formulas";
import { Clock, CheckSquare, Upload, History, CheckCircle, Package } from "lucide-react";
import {
  calcPlannedHours,
  summarizeOrderTimeEntries,
} from "@/lib/orders/time-summary";
import { TIME_ENTRY_STATUS_LABELS } from "@/lib/time-entry";
import { PlanViewer } from "@/components/orders/plan-viewer";
import { PhotoGallery } from "@/components/orders/photo-gallery";
import { OrderBillingSection } from "@/components/orders/billing-section";
import { OrderDetailHeader } from "@/components/orders/order-detail-header";
import { ProjectAssignField } from "@/components/orders/project-assign-field";
import { OrderCustomerSection } from "@/components/orders/order-customer-section";
import { OrderPhases, type OrderPhaseData } from "@/components/orders/order-phases";
import { OrderSharePanel } from "@/components/orders/order-share-panel";
import { OrderTypeSelect } from "@/components/orders/order-type-select";
import { EmployeeMultiSelect } from "@/components/orders/employee-multi-select";
import {
  OrderMaterialEditor,
  type EditableMaterialLine,
  type InventoryArticleOption,
} from "@/components/orders/order-material-editor";
import { usePermission } from "@/components/auth/can-access";
import { fetchJson } from "@/lib/fetch-json";
import { saveJson } from "@/lib/save-toast";
import { CanAccess } from "@/components/auth/can-access";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  priority: string;
  customerConfirmationStatus?: string;
  description: string | null;
  internalNotes: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  customerId?: string;
  projectId?: string | null;
  project?: { id: string; name: string; status?: string } | null;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    company?: string | null;
    billingStreet?: string | null;
    billingZipCode?: string | null;
    billingCity?: string | null;
  };
  property: { street: string; zipCode: string; city: string; label?: string | null };
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
    title?: string | null;
    color?: string | null;
    employee: { user: { firstName: string; lastName: string } } | null;
  }[];
  assignees?: {
    id: string;
    employeeId: string;
    employee: {
      id: string;
      operationalStatus?: string | null;
      user: {
        firstName: string;
        lastName: string;
        phone: string | null;
        role: string;
        isActive: boolean;
      };
      teamMemberships?: Array<{ team: { id: string; name: string } }>;
    };
  }[];
  checklists: { id: string; label: string; isChecked: boolean }[];
  files: { id: string; fileName: string; category: string }[];
  timeEntries: {
    id: string;
    startTime: string;
    endTime: string | null;
    breakMinutes: number;
    activity: string | null;
    notes: string | null;
    status: string;
    employee: {
      id: string;
      hourlyWageNet: number | null;
      user: { firstName: string; lastName: string };
    };
  }[];
  materialUsages: { name: string; quantity: number; unit: string }[];
  title?: string | null;
  orderType?: string;
  orderTypeId?: string | null;
  orderTypeLabel?: string | null;
  orderTypeCustom?: string | null;
  orderTypeDefinition?: { id: string; name: string; isOther: boolean; isActive: boolean } | null;
  materialStatus?: string;
  phases?: OrderPhaseData[];
  materialLines?: {
    id: string;
    name: string;
    quantityRequired: number;
    quantityConsumed?: number;
    unit: string;
    unitPriceNet?: number | null;
    notes?: string | null;
    articleId?: string | null;
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
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [assignStart, setAssignStart] = useState("");
  const [assignEnd, setAssignEnd] = useState("");
  const [assignError, setAssignError] = useState("");
  const [savingAssignees, setSavingAssignees] = useState(false);
  const [availabilityWarning, setAvailabilityWarning] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [confirmConsume, setConfirmConsume] = useState(false);
  const [consuming, setConsuming] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(false);
  const [materialEditLines, setMaterialEditLines] = useState<EditableMaterialLine[]>([]);
  const [articles, setArticles] = useState<InventoryArticleOption[]>([]);
  const [typeDraft, setTypeDraft] = useState({
    orderTypeId: "",
    orderTypeCustom: "",
    isOther: false,
  });
  const [savingType, setSavingType] = useState(false);
  const [savingMaterial, setSavingMaterial] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [calculation, setCalculation] = useState<{ id: string; title: string | null; netSalesPrice: number } | null>(null);
  const [timeline, setTimeline] = useState<{ id: string; at: string; label: string; detail?: string; user?: string }[]>([]);

  const [loadError, setLoadError] = useState("");

  const loadOrder = useCallback(() => {
    if (!id || typeof id !== "string") return;
    setLoadError("");

    fetchJson<OrderDetail>(`/api/orders/${id}`).then((data) => {
      if (data.success && data.data) {
        setOrder(data.data);
        setNotes(data.data.internalNotes ?? "");
        setAssigneeIds((data.data.assignees ?? []).map((a) => a.employeeId));
        setTypeDraft({
          orderTypeId: data.data.orderTypeId ?? "",
          orderTypeCustom: data.data.orderTypeCustom ?? "",
          isOther: Boolean(data.data.orderTypeDefinition?.isOther),
        });
        if (data.data.scheduledStart) {
          setAssignStart((prev) => prev || data.data!.scheduledStart!.slice(0, 16));
        }
        if (data.data.scheduledEnd) {
          setAssignEnd((prev) => prev || data.data!.scheduledEnd!.slice(0, 16));
        }
        return;
      }
      setLoadError(data.error ?? "Auftrag konnte nicht geladen werden");
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
      if (assigneeIds.length !== 1 || !assignStart || !assignEnd || !id) {
        setAvailabilityWarning("");
        return;
      }
      const params = new URLSearchParams({
        employeeId: assigneeIds[0],
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
  }, [assigneeIds, assignStart, assignEnd, id]);

  async function updatePriority(priority: string) {
    await saveJson(
      `/api/orders/${id}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ priority }) },
      { success: "Priorität aktualisiert" }
    );
    loadOrder();
  }

  async function saveOrderType() {
    if (!typeDraft.orderTypeId) {
      toast.error("Bitte einen Auftragstyp wählen");
      return;
    }
    if (typeDraft.isOther && !typeDraft.orderTypeCustom.trim()) {
      toast.error("Bitte den Auftragstyp unter „Sonstiges“ beschreiben");
      return;
    }
    setSavingType(true);
    await saveJson(
      `/api/orders/${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderTypeId: typeDraft.orderTypeId,
          orderTypeCustom: typeDraft.isOther ? typeDraft.orderTypeCustom : null,
        }),
      },
      { success: "Auftragstyp aktualisiert" }
    );
    setSavingType(false);
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

  async function updateConfirmation(customerConfirmationStatus: string) {
    await saveJson(
      `/api/orders/${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerConfirmationStatus }),
      },
      { success: "Kundenbestätigung aktualisiert" }
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

  async function consumeMaterial() {
    if (!order?.materialLines?.length) return;
    const lines = order.materialLines
      .filter((m) => !m.isTool)
      .map((m) => {
        const already = m.quantityConsumed ?? 0;
        const open = Math.max(0, m.quantityRequired - already);
        return { lineId: m.id, quantityConsumed: open };
      })
      .filter((l) => l.quantityConsumed > 0);

    if (!lines.length) {
      toast.message("Kein offenes Material zum Entnehmen.");
      setConfirmConsume(false);
      return;
    }

    setConsuming(true);
    const res = await saveJson(
      `/api/orders/${id}/consumption`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      },
      { success: "Material aus Inventar entnommen" }
    );
    setConsuming(false);
    setConfirmConsume(false);
    if (res.success) loadOrder();
  }

  function startEditMaterial() {
    const lines = (order?.materialLines ?? [])
      .filter((m) => !m.isTool)
      .map((m) => ({
        key: m.id,
        articleId: m.articleId ?? null,
        name: m.name,
        quantityRequired: m.quantityRequired,
        unit: m.unit,
        unitPriceNet: m.unitPriceNet ?? null,
        notes: m.notes ?? "",
      }));
    setMaterialEditLines(lines);
    if (!articles.length) {
      fetch("/api/articles")
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setArticles(d.data);
          else toast.error("Artikel konnten nicht geladen werden");
        })
        .catch(() => toast.error("Artikel konnten nicht geladen werden"));
    }
    setEditingMaterial(true);
  }

  async function saveMaterialEdit() {
    if (!id || typeof id !== "string") return;
    setSavingMaterial(true);
    const res = await saveJson(
      `/api/orders/${id}/material-lines`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keepTools: true,
          lines: materialEditLines
            .filter((l) => l.name.trim())
            .map((l) => ({
              articleId: l.articleId,
              name: l.name,
              quantityRequired: l.quantityRequired,
              unit: l.unit,
              unitPriceNet: l.unitPriceNet,
              notes: l.notes || null,
            })),
        }),
      },
      { success: "Material gespeichert" }
    );
    setSavingMaterial(false);
    if (res.success) {
      setEditingMaterial(false);
      loadOrder();
    }
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

  async function saveAssignees() {
    setAssignError("");
    setSavingAssignees(true);
    const hasTimes = Boolean(assignStart && assignEnd);
    if (hasTimes && new Date(assignEnd) <= new Date(assignStart)) {
      setAssignError("Ende muss nach Beginn liegen");
      setSavingAssignees(false);
      return;
    }
    const res = await fetch(`/api/orders/${id}/assignees`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeIds: assigneeIds,
        syncAppointments: hasTimes,
        startTime: hasTimes ? new Date(assignStart).toISOString() : null,
        endTime: hasTimes ? new Date(assignEnd).toISOString() : null,
      }),
    });
    const data = await res.json();
    setSavingAssignees(false);
    if (data.success) {
      toast.success(
        hasTimes
          ? "Mitarbeiter zugewiesen und Kalender aktualisiert"
          : "Mitarbeiterzuweisung gespeichert"
      );
      loadOrder();
      fetchJson<{ timeline: typeof timeline }>(`/api/orders/${id}/history`).then((d) => {
        if (d.success && d.data?.timeline) setTimeline(d.data.timeline);
      });
    } else {
      setAssignError(data.error ?? "Zuweisung fehlgeschlagen");
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
      setActionMsg("Bitte zuerst Von/Bis unter „Zugewiesene Mitarbeiter“ setzen und Speichern.");
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
    const res = await fetch(`/api/orders/${id}/files`, { method: "POST", body: fd });
    const data = await res.json();
    if (data.success) {
      toast.success("Plan hochgeladen");
      loadOrder();
    } else {
      toast.error(data.error ?? "Upload fehlgeschlagen");
    }
    e.target.value = "";
  }

  if (!order) {
    if (loadError) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-red-600">{loadError}</p>
          <Button type="button" variant="outline" size="sm" onClick={loadOrder}>
            Erneut versuchen
          </Button>
        </div>
      );
    }
    return <div className="text-slate-500">Laden...</div>;
  }

  const plannedHours = calcPlannedHours({
    appointments: order.appointments,
    services: order.services,
    scheduledStart: order.scheduledStart,
    scheduledEnd: order.scheduledEnd,
  });
  const timeSummary = summarizeOrderTimeEntries(order.timeEntries, plannedHours);

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
      <ConfirmDialog
        open={confirmConsume}
        onOpenChange={setConfirmConsume}
        title="Material aus Inventar entnehmen?"
        description="Der offene Packlisten-Bedarf wird als Verbrauch gebucht und der Lagerbestand reduziert. Kalkulation und Angebot bleiben unverändert."
        confirmLabel="Jetzt entnehmen"
        icon={<Package className="h-5 w-5" />}
        loading={consuming}
        onConfirm={consumeMaterial}
      />
      <OrderDetailHeader
        order={order}
        calculation={calculation}
        canPlanTeam={!!(order.scheduledStart || assignStart)}
        onCreateCalculation={createCalculation}
        onPlanTeamInCalendar={planTeamInCalendar}
        onComplete={() => setConfirmComplete(true)}
        onUpdatePriority={updatePriority}
        onUpdateStatus={updateStatus}
        onUpdateConfirmation={updateConfirmation}
      />
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
          <OrderCustomerSection
            customer={order.customer}
            property={order.property}
            services={order.services}
            description={order.description}
          />

          <CanAccess permission="orders.write">
            <Card title="Projekt">
              <ProjectAssignField
                customerId={order.customerId ?? null}
                value={order.projectId ?? order.project?.id ?? ""}
                onChange={async (projectId) => {
                  const res = await saveJson(
                    `/api/orders/${order.id}`,
                    {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ projectId: projectId || null }),
                    },
                    { success: projectId ? "Projekt zugeordnet" : "Projektzuordnung entfernt" }
                  );
                  if (res.success) loadOrder();
                }}
              />
            </Card>
          </CanAccess>

          <CanAccess permission="orders.write">
            <Card title="Auftragstyp">
              <OrderTypeSelect
                valueId={typeDraft.orderTypeId}
                customValue={typeDraft.orderTypeCustom}
                includeInactiveIds={order.orderTypeId ? [order.orderTypeId] : []}
                onChange={({ orderTypeId, orderTypeCustom, isOther }) =>
                  setTypeDraft({ orderTypeId, orderTypeCustom, isOther })
                }
              />
              <Button
                className="mt-4"
                size="sm"
                variant="action"
                disabled={savingType}
                onClick={saveOrderType}
              >
                {savingType ? "Speichern…" : "Auftragstyp speichern"}
              </Button>
            </Card>
          </CanAccess>

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

          <Card title="Packliste / Material">
              <p className="text-xs text-slate-400 mb-2">
                Materialstatus: {MATERIAL_STATUS_LABELS[order.materialStatus ?? "NOT_CHECKED"] ?? order.materialStatus}
              </p>
              {editingMaterial ? (
                <div className="space-y-3">
                  <OrderMaterialEditor
                    compact
                    lines={materialEditLines}
                    articles={articles}
                    onChange={setMaterialEditLines}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="action"
                      size="sm"
                      disabled={savingMaterial}
                      onClick={saveMaterialEdit}
                    >
                      {savingMaterial ? "Speichern…" : "Material speichern"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingMaterial(false)}
                    >
                      Abbrechen
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {(order.materialLines ?? []).map((m) => {
                    const reserved = m.reservations?.some((r) =>
                      ["VORGESCHLAGEN", "RESERVIERT"].includes(r.status)
                    );
                    const loc = m.reservations?.find((r) =>
                      ["VORGESCHLAGEN", "RESERVIERT"].includes(r.status)
                    )?.storageLocation?.name;
                    const consumed = m.quantityConsumed ?? 0;
                    return (
                    <div key={m.id} className="flex justify-between items-center gap-2 py-2 border-b border-slate-50 last:border-0 text-sm">
                      <span>
                        {m.name}{m.isTool ? " (Werkzeug)" : ""}{loc ? ` · ${loc}` : ""}
                        {m.unitPriceNet != null ? (
                          <span className="block text-xs text-slate-400">
                            {m.unitPriceNet.toLocaleString("de-DE", { style: "currency", currency: "EUR" })} / {m.unit}
                          </span>
                        ) : null}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-slate-500">
                          {m.quantityRequired} {m.unit}
                          {consumed > 0 ? ` · entnommen ${consumed}` : ""}
                        </span>
                        {reserved ? (
                          <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Reserviert</span>
                        ) : (
                          <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Offen</span>
                        )}
                      </div>
                    </div>
                    );
                  })}
                  {!(order.materialLines ?? []).length && (
                    <p className="text-sm text-slate-500 py-2">Noch kein Material hinterlegt.</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {canEditPhases && (
                      <Button size="sm" variant="outline" onClick={startEditMaterial}>
                        Material bearbeiten
                      </Button>
                    )}
                    <CanAccess permission="inventory.reserve">
                      <Button size="sm" variant="outline" onClick={reserveMaterial}>
                        Material reservieren
                      </Button>
                    </CanAccess>
                    <CanAccess permission="inventory.write">
                      <Button size="sm" variant="action" onClick={() => setConfirmConsume(true)}>
                        Material aus Inventar entnehmen
                      </Button>
                    </CanAccess>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Reservierung plant nur — Bestand sinkt erst nach bewusster Entnahme.
                  </p>
                </>
              )}
            </Card>

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
          <Card title="Zugewiesene Mitarbeiter">
            {(order.assignees?.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-500 mb-3">Noch keine Einzelmitarbeiter zugewiesen.</p>
            ) : (
              <ul className="mb-4 divide-y divide-slate-100">
                {(order.assignees ?? []).map((a) => {
                  const hours = timeSummary.byEmployee.find((r) => r.employeeId === a.employeeId);
                  const teams = (a.employee.teamMemberships ?? [])
                    .map((m) => m.team.name)
                    .filter(Boolean);
                  return (
                    <li key={a.id} className="py-2.5 first:pt-0">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-medium text-slate-800">
                          {a.employee.user.firstName} {a.employee.user.lastName}
                        </p>
                        <span className="text-xs text-slate-400">
                          {a.employee.user.isActive ? "Aktiv" : "Inaktiv"}
                          {a.employee.operationalStatus
                            ? ` · ${a.employee.operationalStatus}`
                            : ""}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {ROLE_LABELS[a.employee.user.role] ?? a.employee.user.role}
                        {a.employee.user.phone ? ` · ${a.employee.user.phone}` : ""}
                        {teams.length ? ` · ${teams.join(", ")}` : ""}
                        {hours ? ` · ${hours.hours.toFixed(2)} h gebucht` : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
            {order.team && (
              <p className="mb-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Zusätzlich Team „{order.team.name}“ (Teamzuweisung getrennt von Einzelmitarbeitern).
              </p>
            )}
            <p className="text-xs text-slate-500 mb-3">
              Mehrfachauswahl: Assignees sehen den Auftrag in Monteur-App und Stundenzettel.
              Mit Von/Bis werden Kalendertermine für alle Ausgewählten angelegt/aktualisiert.
            </p>
            {assignError && <p className="text-sm text-red-600 mb-2">{assignError}</p>}
            {availabilityWarning && (
              <p className="text-sm text-amber-700 mb-2">⚠ {availabilityWarning}</p>
            )}
            <div className="space-y-3">
              <EmployeeMultiSelect
                employees={allEmployees.map((emp) => ({
                  id: emp.id,
                  firstName: emp.user.firstName,
                  lastName: emp.user.lastName,
                  role: ROLE_LABELS[emp.user.role] ?? emp.user.role,
                  // „busy“ blockiert nicht die Zuweisung – nur Hinweis in der Liste
                  disabledReason:
                    emp.assignmentStatus === "busy" && !assigneeIds.includes(emp.id)
                      ? "bereits eingeplant (Kalenderkonflikt möglich)"
                      : undefined,
                }))}
                value={assigneeIds}
                onChange={setAssigneeIds}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-slate-500">Von (Kalender)</label>
                  <input
                    type="datetime-local"
                    className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
                    value={assignStart}
                    onChange={(e) => setAssignStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Bis (Kalender)</label>
                  <input
                    type="datetime-local"
                    className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
                    value={assignEnd}
                    onChange={(e) => setAssignEnd(e.target.value)}
                  />
                </div>
              </div>
              <Button size="sm" onClick={saveAssignees} disabled={savingAssignees}>
                {savingAssignees ? "Speichern…" : "Zuweisung speichern"}
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
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: apt.color || "#0d5c63" }}
                    aria-hidden
                  />
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span className="font-medium text-slate-800">
                    {apt.title?.trim() || order.title || "Termin"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 ml-6">
                  {formatDateTime(apt.startTime)}
                  {apt.endTime
                    ? ` – ${new Date(apt.endTime).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`
                    : ""}
                  {apt.employee
                    ? ` · ${apt.employee.user.firstName} ${apt.employee.user.lastName}`
                    : ""}
                </p>
              </div>
            ))}
            {!order.appointments.length && (
              <p className="text-sm text-slate-500">Kein Termin geplant</p>
            )}
          </Card>

          <Card title="Arbeitszeit">
            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
              <div>
                <p className="text-xs text-slate-500">Geplant</p>
                <p className="font-semibold">{timeSummary.plannedHours.toFixed(2)} h</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Tatsächlich</p>
                <p className="font-semibold text-[#0d5c63]">
                  {timeSummary.actualHours.toFixed(2)} h
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Differenz</p>
                <p
                  className={`font-semibold ${
                    timeSummary.deltaHours > 0
                      ? "text-amber-700"
                      : timeSummary.deltaHours < 0
                        ? "text-emerald-700"
                        : "text-slate-700"
                  }`}
                >
                  {timeSummary.deltaHours > 0 ? "+" : ""}
                  {timeSummary.deltaHours.toFixed(2)} h
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Arbeitskosten</p>
                <p className="font-semibold">
                  {timeSummary.laborCostNet != null
                    ? formatEuro(timeSummary.laborCostNet)
                    : "—"}
                </p>
              </div>
            </div>

            {timeSummary.byEmployee.length > 0 && (
              <div className="mb-3 space-y-1 border-t border-slate-100 pt-2">
                <p className="text-xs font-medium text-slate-600">Nach Mitarbeiter</p>
                {timeSummary.byEmployee.map((row) => (
                  <div
                    key={row.employeeId}
                    className="flex justify-between gap-2 text-sm"
                  >
                    <span>{row.name}</span>
                    <span className="text-slate-600">
                      {row.hours.toFixed(2)} h
                      {row.laborCostNet != null
                        ? ` · ${formatEuro(row.laborCostNet)}`
                        : row.hourlyWageNet == null
                          ? " · kein Lohn hinterlegt"
                          : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {timeSummary.entries.length === 0 ? (
              <p className="text-sm text-slate-500">Noch keine Zeiten gebucht.</p>
            ) : (
              <div className="divide-y divide-slate-50 border-t border-slate-100">
                {timeSummary.entries.map((t) => (
                  <div key={t.id} className="py-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <p className="font-medium">{t.employeeName}</p>
                      <p className="font-semibold text-[#0d5c63]">
                        {t.hours != null ? `${t.hours.toFixed(2)} h` : "läuft"}
                      </p>
                    </div>
                    {t.activity && (
                      <p className="text-xs text-slate-500">{t.activity}</p>
                    )}
                    <p className="text-xs text-slate-400">
                      {formatDateTime(t.startTime)}
                      {t.endTime ? ` – ${formatDateTime(t.endTime)}` : ""}
                      {" · "}
                      {TIME_ENTRY_STATUS_LABELS[t.status] ?? t.status}
                      {t.laborCostNet != null
                        ? ` · ${formatEuro(t.laborCostNet)}`
                        : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-slate-400 mt-3">
              Tatsächliche Stunden können bewusst in Kalkulation/Rechnung übernommen
              werden — nicht automatisch.
            </p>
            <Link
              href="/dashboard/stunden"
              className="inline-block mt-1 text-xs text-[#0d5c63] underline-offset-2 hover:underline"
            >
              Zu Team-Stunden →
            </Link>
          </Card>

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
