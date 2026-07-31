"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { OrderTypeSelect } from "@/components/orders/order-type-select";
import { saveJson } from "@/lib/save-toast";
import { usePermission } from "@/components/auth/can-access";
import { APPOINTMENT_COLORS } from "@/lib/calendar/appointment-colors";

export type CalendarSlotSelection = {
  start: Date;
  end: Date;
  employeeIdHint?: string;
};

type CustomerOption = {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  properties: {
    id: string;
    label: string | null;
    street: string;
    zipCode: string;
    city: string;
  }[];
};

type OrderOption = {
  id: string;
  orderNumber: string;
  title: string | null;
  customerId: string;
  propertyId: string;
  projectId: string | null;
  teamId: string | null;
  vehicleId: string | null;
  customer: { firstName: string; lastName: string };
  property: { street: string; zipCode: string; city: string } | null;
  project: { id: string; name: string } | null;
};

type ProjectOption = { id: string; name: string; customerId: string };
type EmployeeOption = { id: string; user: { firstName: string; lastName: string } };
type TeamOption = { id: string; name: string };
type VehicleOption = { id: string; name: string };

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

interface CalendarCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: CalendarSlotSelection | null;
  employees: EmployeeOption[];
  teams: TeamOption[];
  vehicles: VehicleOption[];
  onCreated: () => void;
}

export function CalendarCreateDialog({
  open,
  onOpenChange,
  slot,
  employees,
  teams,
  vehicles,
  onCreated,
}: CalendarCreateDialogProps) {
  const canCreateOrder = usePermission("orders.write");
  const [mode, setMode] = useState<"standalone" | "existing" | "new">("standalone");
  const [saving, setSaving] = useState(false);

  const [dateStr, setDateStr] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [employeeId, setEmployeeId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [notes, setNotes] = useState("");
  const [color, setColor] = useState("#0d5c63");
  const [addressText, setAddressText] = useState("");
  const [status, setStatus] = useState("GEPLANT");

  const [orderId, setOrderId] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [orders, setOrders] = useState<OrderOption[]>([]);

  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [orderTypeId, setOrderTypeId] = useState("");
  const [orderTypeCustom, setOrderTypeCustom] = useState("");

  useEffect(() => {
    if (!open || !slot) return;
    setMode("standalone");
    setDateStr(toDateInput(slot.start));
    setStartTime(toTimeInput(slot.start));
    setEndTime(toTimeInput(slot.end));
    setEmployeeId(slot.employeeIdHint ?? "");
    setTeamId("");
    setVehicleId("");
    setProjectId("");
    setNotes("");
    setColor("#0d5c63");
    setAddressText("");
    setStatus("GEPLANT");
    setOrderId("");
    setOrderSearch("");
    setTitle("");
    setCustomerId("");
    setPropertyId("");
    setOrderTypeId("");
    setOrderTypeCustom("");
  }, [open, slot]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/orders")
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        setOrders(
          (d.data as OrderOption[]).map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            title: o.title ?? null,
            customerId: o.customerId,
            propertyId: o.propertyId,
            projectId: o.projectId ?? null,
            teamId: o.teamId ?? null,
            vehicleId: o.vehicleId ?? null,
            customer: o.customer,
            property: o.property,
            project: o.project,
          }))
        );
      });
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCustomers(d.data);
      });
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        const list = (d.data as { id: string; name: string; customer?: { id: string }; customerId?: string }[]).map(
          (p) => ({
            id: p.id,
            name: p.name,
            customerId: p.customerId ?? p.customer?.id ?? "",
          })
        );
        setProjects(list.filter((p) => p.customerId));
      });
  }, [open]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    if (!q) return orders.slice(0, 40);
    return orders
      .filter((o) => {
        const hay = `${o.orderNumber} ${o.title ?? ""} ${o.customer.lastName} ${o.customer.firstName}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 40);
  }, [orders, orderSearch]);

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const properties = selectedCustomer?.properties ?? [];

  const projectsForCustomer = useMemo(() => {
    if (mode === "standalone") return projects;
    const cid =
      mode === "new"
        ? customerId
        : orders.find((o) => o.id === orderId)?.customerId ?? "";
    if (!cid) return projects;
    return projects.filter((p) => p.customerId === cid);
  }, [mode, customerId, orderId, orders, projects]);

  function onSelectOrder(id: string) {
    setOrderId(id);
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    setCustomerId(order.customerId);
    setPropertyId(order.propertyId);
    setProjectId(order.projectId ?? "");
    setTeamId(order.teamId ?? "");
    setVehicleId(order.vehicleId ?? "");
    if (order.title) setTitle(order.title);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!slot || saving) return;
    const start = combineLocal(dateStr, startTime);
    const end = combineLocal(dateStr, endTime);
    if (end <= start) return;

    setSaving(true);
    const base = {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      employeeId: employeeId || null,
      teamId: teamId || null,
      vehicleId: vehicleId || null,
      projectId: projectId || null,
      notes: notes.trim() || null,
      color: color || null,
      status,
      addressText: addressText.trim() || null,
      title: title.trim() || null,
    };

    const payload =
      mode === "standalone"
        ? { mode: "standalone" as const, ...base, title: title.trim() }
        : mode === "existing"
          ? { mode: "existing" as const, ...base, orderId }
          : {
              mode: "new" as const,
              ...base,
              title: title.trim(),
              customerId,
              propertyId,
              orderTypeId: orderTypeId || null,
              orderTypeCustom: orderTypeCustom.trim() || null,
            };

    const res = await saveJson("/api/appointments/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }, {
      loading: "Termin wird gespeichert …",
      success:
        mode === "standalone"
          ? "Termin erstellt"
          : mode === "existing"
            ? "Auftrag eingeplant"
            : "Termin und Auftrag erstellt",
      error: "Termin konnte nicht gespeichert werden",
    });

    setSaving(false);
    if (res.success) {
      onOpenChange(false);
      onCreated();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-4 pb-2">
            <DialogTitle>Termin erstellen</DialogTitle>
            <DialogDescription>
              Freier Termin, bestehender Auftrag oder neuer Auftrag.
            </DialogDescription>
          </DialogHeader>

          <div className="px-4 pb-2 grid grid-cols-3 gap-1.5">
            {(
              [
                ["standalone", "Frei"],
                ["existing", "Auftrag"],
                ["new", "Neu"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                disabled={id === "new" && !canCreateOrder}
                onClick={() => {
                  if (id === "new" && !canCreateOrder) return;
                  setMode(id);
                }}
                className={`rounded-lg px-2 py-2 text-xs sm:text-sm font-medium transition-colors disabled:opacity-40 ${
                  mode === id
                    ? "bg-[#0d5c63] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="px-4 py-3 space-y-3 border-t border-slate-100">
            {(mode === "standalone" || mode === "new") && (
              <div className="space-y-1.5">
                <Label htmlFor="cal-title">Titel *</Label>
                <Input
                  id="cal-title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    mode === "standalone"
                      ? "z. B. Lager aufräumen"
                      : "z. B. Bad renovieren"
                  }
                />
              </div>
            )}

            {mode === "existing" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="cal-order-search">Auftrag *</Label>
                  <Input
                    id="cal-order-search"
                    placeholder="Nr., Kunde oder Titel suchen…"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                  />
                  <select
                    required
                    value={orderId}
                    onChange={(e) => onSelectOrder(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                  >
                    <option value="">Auftrag wählen…</option>
                    {filteredOrders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.orderNumber} · {o.customer.lastName}
                        {o.title ? ` · ${o.title}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}

            {mode === "new" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="cal-customer">Kunde *</Label>
                  <select
                    id="cal-customer"
                    required
                    value={customerId}
                    onChange={(e) => {
                      setCustomerId(e.target.value);
                      setPropertyId("");
                      setProjectId("");
                      const c = customers.find((x) => x.id === e.target.value);
                      const primary = c?.properties[0];
                      if (primary) setPropertyId(primary.id);
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                  >
                    <option value="">Kunde wählen…</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.lastName}, {c.firstName}
                        {c.company ? ` (${c.company})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cal-property">Adresse *</Label>
                  <select
                    id="cal-property"
                    required
                    value={propertyId}
                    onChange={(e) => setPropertyId(e.target.value)}
                    disabled={!customerId}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:opacity-50"
                  >
                    <option value="">Adresse wählen…</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label ? `${p.label}: ` : ""}
                        {p.street}, {p.zipCode} {p.city}
                      </option>
                    ))}
                  </select>
                </div>
                <OrderTypeSelect
                  valueId={orderTypeId}
                  customValue={orderTypeCustom}
                  onChange={(next) => {
                    setOrderTypeId(next.orderTypeId);
                    setOrderTypeCustom(next.orderTypeCustom);
                  }}
                  label="Tätigkeit / Auftragstyp"
                  showManageLink={false}
                  showQuickAdd={false}
                />
              </>
            ) : null}

            {mode === "standalone" && (
              <div className="space-y-1.5">
                <Label htmlFor="cal-address">Adresse (optional)</Label>
                <Input
                  id="cal-address"
                  value={addressText}
                  onChange={(e) => setAddressText(e.target.value)}
                  placeholder="Straße, Ort…"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Farbe</Label>
              <div className="flex flex-wrap gap-2">
                {APPOINTMENT_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    title={c.label}
                    onClick={() => setColor(c.hex)}
                    className={`h-8 w-8 rounded-full border-2 ${
                      color === c.hex ? "border-slate-900 scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cal-project">Projekt (optional)</Label>
              <select
                id="cal-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
              >
                <option value="">Kein Projekt</option>
                {projectsForCustomer.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="cal-date">Datum *</Label>
                <Input
                  id="cal-date"
                  type="date"
                  className="min-w-0 w-full"
                  required
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="cal-start">Start *</Label>
                <Input
                  id="cal-start"
                  type="time"
                  className="min-w-0 w-full"
                  required
                  step={900}
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="cal-end">Ende *</Label>
                <Input
                  id="cal-end"
                  type="time"
                  className="min-w-0 w-full"
                  required
                  step={900}
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="cal-employee">Mitarbeiter</Label>
                <select
                  id="cal-employee"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
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
                <Label htmlFor="cal-team">Team</Label>
                <select
                  id="cal-team"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
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

            <div className="space-y-1.5">
              <Label htmlFor="cal-vehicle">Fahrzeug (optional)</Label>
              <select
                id="cal-vehicle"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
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
              <Label htmlFor="cal-status">Status</Label>
              <select
                id="cal-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
              >
                <option value="GEPLANT">Geplant</option>
                <option value="UNTERWEGS">Unterwegs</option>
                <option value="ANGEKOMMEN">Angekommen</option>
                <option value="IN_ARBEIT">In Arbeit</option>
                <option value="ABGESCHLOSSEN">Abgeschlossen</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cal-notes">Notiz</Label>
              <textarea
                id="cal-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm resize-y min-h-[64px]"
                placeholder="Hinweise fürs Team…"
              />
            </div>
          </div>

          <DialogFooter className="mx-0 mb-0 rounded-b-xl">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving} className="bg-[#0d5c63] hover:bg-[#0a4a50]">
              {saving ? "Speichern…" : "Termin speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
