"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CanAccess } from "@/components/auth/can-access";
import { AddButton } from "@/components/ui/add-button";
import { saveJson } from "@/lib/save-toast";
import { VEHICLE_STATUS_LABELS, VEHICLE_STATUS_BADGE } from "@/lib/utils";
import { ChevronLeft, Trash2, Truck, Pencil, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";

interface Vehicle {
  id: string;
  name: string;
  licensePlate: string | null;
  vehicleType: string | null;
  status: string;
  notes: string | null;
  isActive: boolean;
  assignedEmployeeId: string | null;
  assignedEmployee: { user: { firstName: string; lastName: string } } | null;
  teams?: { id: string; name: string }[];
}

interface Employee {
  id: string;
  user: { firstName: string; lastName: string };
}

const EMPTY_FORM = {
  name: "",
  licensePlate: "",
  vehicleType: "",
  status: "VERFUEGBAR",
  notes: "",
  assignedEmployeeId: "",
};

export default function FahrzeugePage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  function load() {
    Promise.all([
      fetch("/api/vehicles?includeInactive=1").then((r) => r.json()),
      fetch("/api/employees").then((r) => r.json()),
    ]).then(([v, e]) => {
      if (v.success) setVehicles(v.data);
      if (e.success) setEmployees(e.data);
    });
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  }

  function openEdit(v: Vehicle) {
    setEditId(v.id);
    setForm({
      name: v.name,
      licensePlate: v.licensePlate ?? "",
      vehicleType: v.vehicleType ?? "",
      status: v.status,
      notes: v.notes ?? "",
      assignedEmployeeId: v.assignedEmployeeId ?? "",
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditId(null);
    setForm({ ...EMPTY_FORM });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const url = editId ? `/api/vehicles/${editId}` : "/api/vehicles";
    const res = await saveJson(url, {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.success) return;
    closeForm();
    load();
  }

  async function deactivate(id: string) {
    if (!confirm("Fahrzeug deaktivieren?")) return;
    const res = await fetch(`/api/vehicles/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Fahrzeug deaktiviert"); load(); }
  }

  async function reactivate(id: string) {
    const res = await saveJson(`/api/vehicles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true, status: "VERFUEGBAR" }),
    });
    if (res.success) load();
  }

  async function hardDelete(id: string) {
    if (!confirm("Fahrzeug endgültig löschen? Das kann nicht rückgängig gemacht werden.")) return;
    const res = await fetch(`/api/vehicles/${id}?hard=1`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) { toast.success("Fahrzeug gelöscht"); load(); }
    else toast.error(data.error ?? "Löschen fehlgeschlagen");
  }

  return (
    <div>
      <Link href="/dashboard/disposition" className="text-sm text-[#0d5c63] flex items-center gap-1 mb-4 hover:underline">
        <ChevronLeft className="h-4 w-4" /> Zurück zur Disposition
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Fahrzeuge / Fuhrpark</h1>
          <p className="text-sm text-slate-500 mt-1">Autos anlegen, zuweisen und Status pflegen</p>
        </div>
        <CanAccess permission="orders.assign">
          <AddButton onClick={openCreate}>Fahrzeug anlegen</AddButton>
        </CanAccess>
      </div>

      <CanAccess permission="orders.assign">
        {showForm && (
          <Card
            title={editId ? "Fahrzeug bearbeiten" : "Neues Fahrzeug"}
            action={
              <button type="button" onClick={closeForm} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            }
            className="mb-6"
          >
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Bezeichnung *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="z. B. Transporter 1" />
                <Input label="Kennzeichen" value={form.licensePlate} onChange={(e) => setForm({ ...form, licensePlate: e.target.value })} placeholder="z. B. M-AB 1234" />
                <Input label="Fahrzeugtyp" value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value })} placeholder="z. B. Sprinter, PKW, Anhänger" />
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <select className="w-full h-8 rounded-lg border border-input mt-1.5 px-2.5 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {Object.entries(VEHICLE_STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium">Zugewiesener Mitarbeiter (optional)</label>
                  <select className="w-full h-8 rounded-lg border border-input mt-1.5 px-2.5 text-sm" value={form.assignedEmployeeId} onChange={(e) => setForm({ ...form, assignedEmployeeId: e.target.value })}>
                    <option value="">— Kein Mitarbeiter —</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.user.firstName} {emp.user.lastName}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Notizen</label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="z. B. TÜV fällig, Besonderheiten" />
              </div>
              <div className="flex gap-2">
                <Button type="submit" variant="action">{editId ? "Änderungen speichern" : "Fahrzeug speichern"}</Button>
                <Button type="button" variant="outline" onClick={closeForm}>Abbrechen</Button>
              </div>
            </form>
          </Card>
        )}
      </CanAccess>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {vehicles.map((v) => (
          <Card key={v.id} className={v.isActive ? "" : "opacity-60"}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Truck className="h-5 w-5 text-[#0d5c63] shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{v.name}</h3>
                  {v.licensePlate && <p className="text-xs text-slate-400">{v.licensePlate}</p>}
                </div>
              </div>
              <Badge status={VEHICLE_STATUS_BADGE[v.status] ?? "DRAFT"} label={VEHICLE_STATUS_LABELS[v.status] ?? v.status} />
            </div>

            <dl className="mt-3 space-y-1 text-sm">
              {v.vehicleType && (
                <div className="flex gap-2"><dt className="text-slate-500 w-24 shrink-0">Typ</dt><dd>{v.vehicleType}</dd></div>
              )}
              {v.assignedEmployee && (
                <div className="flex gap-2"><dt className="text-slate-500 w-24 shrink-0">Mitarbeiter</dt><dd>{v.assignedEmployee.user.firstName} {v.assignedEmployee.user.lastName}</dd></div>
              )}
              {v.teams && v.teams.length > 0 && (
                <div className="flex gap-2"><dt className="text-slate-500 w-24 shrink-0">Teams</dt><dd>{v.teams.map((t) => t.name).join(", ")}</dd></div>
              )}
              {v.notes && (
                <div className="flex gap-2"><dt className="text-slate-500 w-24 shrink-0">Notizen</dt><dd className="whitespace-pre-wrap">{v.notes}</dd></div>
              )}
            </dl>

            <CanAccess permission="orders.assign">
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <Button size="sm" variant="outline" onClick={() => openEdit(v)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Bearbeiten
                </Button>
                {v.isActive ? (
                  <Button size="sm" variant="ghost" className="text-amber-600" onClick={() => deactivate(v.id)}>
                    Deaktivieren
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="text-green-600" onClick={() => reactivate(v.id)}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reaktivieren
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-red-500" onClick={() => hardDelete(v.id)} title="Endgültig löschen">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CanAccess>
          </Card>
        ))}
        {!vehicles.length && (
          <p className="text-sm text-slate-500 col-span-full text-center py-8">
            Noch keine Fahrzeuge angelegt. Legen Sie oben Ihr erstes Fahrzeug an.
          </p>
        )}
      </div>
    </div>
  );
}
