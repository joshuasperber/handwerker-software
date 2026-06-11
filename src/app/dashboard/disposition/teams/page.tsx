"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CanAccess } from "@/components/auth/can-access";
import { AddButton } from "@/components/ui/add-button";
import { saveJson } from "@/lib/save-toast";
import { ChevronLeft, Trash2, Users, Pencil, RotateCcw, X, Truck } from "lucide-react";
import { toast } from "sonner";

interface Team {
  id: string;
  name: string;
  isActive: boolean;
  vehicle: { id: string; name: string } | null;
  members: { employee: { id: string; user: { firstName: string; lastName: string } }; isForeman: boolean }[];
}

interface Employee {
  id: string;
  user: { firstName: string; lastName: string };
}

interface Vehicle {
  id: string;
  name: string;
}

const EMPTY_FORM = { name: "", vehicleId: "", memberIds: [] as string[] };

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  function load() {
    Promise.all([
      fetch("/api/teams?includeInactive=1").then((r) => r.json()),
      fetch("/api/employees").then((r) => r.json()),
      fetch("/api/vehicles").then((r) => r.json()),
    ]).then(([t, e, v]) => {
      if (t.success) setTeams(t.data);
      if (e.success) setEmployees(e.data);
      if (v.success) setVehicles(v.data);
    });
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  }

  function openEdit(team: Team) {
    setEditId(team.id);
    setForm({
      name: team.name,
      vehicleId: team.vehicle?.id ?? "",
      // Vorarbeiter (erster) zuerst, damit die Reihenfolge erhalten bleibt.
      memberIds: [...team.members].sort((a, b) => Number(b.isForeman) - Number(a.isForeman)).map((m) => m.employee.id),
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
    const url = editId ? `/api/teams/${editId}` : "/api/teams";
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
    if (!confirm("Team deaktivieren?")) return;
    const res = await fetch(`/api/teams/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Team deaktiviert"); load(); }
  }

  async function reactivate(id: string) {
    const res = await saveJson(`/api/teams/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    if (res.success) load();
  }

  function toggleMember(employeeId: string) {
    setForm((f) => ({
      ...f,
      memberIds: f.memberIds.includes(employeeId)
        ? f.memberIds.filter((x) => x !== employeeId)
        : [...f.memberIds, employeeId],
    }));
  }

  return (
    <div>
      <Link href="/dashboard/disposition" className="text-sm text-[#0d5c63] flex items-center gap-1 mb-4 hover:underline">
        <ChevronLeft className="h-4 w-4" /> Zurück zur Disposition
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Teams & Kolonnen</h1>
          <p className="text-sm text-slate-500 mt-1">Feste Arbeitsgruppen für die Einsatzplanung</p>
        </div>
        <CanAccess permission="orders.assign">
          <AddButton onClick={openCreate}>Team anlegen</AddButton>
        </CanAccess>
      </div>

      <Card className="mb-6 !p-4 bg-slate-50">
        <p className="text-sm text-slate-600">
          <strong>Was sind Teams?</strong> Teams sind feste Kolonnen (z. B. „Team Alpha“ mit Tom + Lisa + Transporter 1).
          In der Disposition sehen Sie, wer zusammen arbeitet. Beim Auftrag und im Kalender können Sie ein Team zuweisen.
          Der erste ausgewählte Mitarbeiter wird automatisch Vorarbeiter.
        </p>
      </Card>

      <CanAccess permission="orders.assign">
      {showForm && (
        <Card
          title={editId ? "Team bearbeiten" : "Neues Team"}
          action={
            <button type="button" onClick={closeForm} className="text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          }
          className="mb-6"
        >
          <form onSubmit={submit} className="space-y-4">
            <Input label="Teamname *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="z. B. Kolonne Nord" />
            <div>
              <label className="text-sm font-medium">Fahrzeug (optional)</label>
              <select className="w-full h-8 rounded-lg border border-input mt-1.5 px-2.5 text-sm" value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
                <option value="">— Kein Fahrzeug —</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Mitglieder <span className="text-xs text-slate-400">(erster = Vorarbeiter)</span></p>
              <div className="flex flex-wrap gap-2">
                {employees.map((emp) => {
                  const idx = form.memberIds.indexOf(emp.id);
                  return (
                    <label key={emp.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${idx >= 0 ? "border-[#0d5c63] bg-[#0d5c63]/5" : "border-slate-200"}`}>
                      <input type="checkbox" checked={idx >= 0} onChange={() => toggleMember(emp.id)} />
                      {emp.user.firstName} {emp.user.lastName}
                      {idx === 0 && <span className="text-[10px] font-semibold text-[#0d5c63]">Vorarbeiter</span>}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="action">{editId ? "Änderungen speichern" : "Team speichern"}</Button>
              <Button type="button" variant="outline" onClick={closeForm}>Abbrechen</Button>
            </div>
          </form>
        </Card>
      )}
      </CanAccess>

      <div className="grid gap-4 sm:grid-cols-2">
        {teams.map((team) => (
          <Card key={team.id} className={team.isActive ? "" : "opacity-60"}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[#0d5c63]" />
                <h3 className="font-semibold text-lg">{team.name}</h3>
                {!team.isActive && <span className="text-[10px] uppercase tracking-wide text-slate-400">inaktiv</span>}
              </div>
            </div>
            {team.vehicle && (
              <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                <Truck className="h-3.5 w-3.5" /> {team.vehicle.name}
              </p>
            )}
            <ul className="mt-3 text-sm space-y-1">
              {team.members.map((m) => (
                <li key={m.employee.id}>
                  {m.employee.user.firstName} {m.employee.user.lastName}
                  {m.isForeman && " (Vorarbeiter)"}
                </li>
              ))}
              {team.members.length === 0 && <li className="text-slate-400">Keine Mitglieder</li>}
            </ul>
            <CanAccess permission="orders.assign">
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <Button size="sm" variant="outline" onClick={() => openEdit(team)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Bearbeiten
                </Button>
                {team.isActive ? (
                  <Button size="sm" variant="ghost" className="text-amber-600" onClick={() => deactivate(team.id)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Deaktivieren
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="text-green-600" onClick={() => reactivate(team.id)}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reaktivieren
                  </Button>
                )}
              </div>
            </CanAccess>
          </Card>
        ))}
      </div>
    </div>
  );
}
