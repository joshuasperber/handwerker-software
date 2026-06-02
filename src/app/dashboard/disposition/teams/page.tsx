"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CanAccess } from "@/components/auth/can-access";
import { ChevronLeft, Plus, Trash2, Users } from "lucide-react";

interface Team {
  id: string;
  name: string;
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

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", vehicleId: "", memberIds: [] as string[] });

  function load() {
    Promise.all([
      fetch("/api/teams").then((r) => r.json()),
      fetch("/api/employees").then((r) => r.json()),
      fetch("/api/vehicles").then((r) => r.json()),
    ]).then(([t, e, v]) => {
      if (t.success) setTeams(t.data);
      if (e.success) setEmployees(e.data);
      if (v.success) setVehicles(v.data);
    });
  }

  useEffect(() => { load(); }, []);

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setForm({ name: "", vehicleId: "", memberIds: [] });
    load();
  }

  async function removeTeam(id: string) {
    if (!confirm("Team deaktivieren?")) return;
    await fetch(`/api/teams/${id}`, { method: "DELETE" });
    load();
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

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Teams & Kolonnen</h1>
          <p className="text-sm text-slate-500 mt-1">Feste Arbeitsgruppen für die Einsatzplanung</p>
        </div>
        <CanAccess permission="orders.assign">
          <Button size="lg" variant="action" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-5 w-5" /> Team anlegen
          </Button>
        </CanAccess>
      </div>

      <Card className="mb-6 !p-4 bg-slate-50">
        <p className="text-sm text-slate-600">
          <strong>Was sind Teams?</strong> Teams sind feste Kolonnen (z. B. „Team Alpha“ mit Tom + Lisa + Transporter 1).
          In der Disposition sehen Sie, wer zusammen arbeitet. Beim Auftrag können Sie ein Team zuweisen.
          „Team Alpha“ im Demo stammt aus dem Seed – hier legen Sie eigene Teams an.
        </p>
      </Card>

      <CanAccess permission="orders.assign">
      {showForm && (
        <Card title="Neues Team" className="mb-6">
          <form onSubmit={createTeam} className="space-y-4">
            <Input label="Teamname *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="z. B. Kolonne Nord" />
            <div>
              <label className="text-sm font-medium">Fahrzeug (optional)</label>
              <select className="w-full h-10 rounded-lg border mt-1 px-3 text-sm" value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
                <option value="">— Kein Fahrzeug —</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Mitglieder</p>
              <div className="flex flex-wrap gap-2">
                {employees.map((emp) => (
                  <label key={emp.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${form.memberIds.includes(emp.id) ? "border-[#0d5c63] bg-[#0d5c63]/5" : "border-slate-200"}`}>
                    <input type="checkbox" checked={form.memberIds.includes(emp.id)} onChange={() => toggleMember(emp.id)} />
                    {emp.user.firstName} {emp.user.lastName}
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" variant="action">Team speichern</Button>
          </form>
        </Card>
      )}
      </CanAccess>

      <div className="grid gap-4 sm:grid-cols-2">
        {teams.map((team) => (
          <Card key={team.id}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[#0d5c63]" />
                <h3 className="font-semibold text-lg">{team.name}</h3>
              </div>
              <CanAccess permission="orders.assign">
                <button type="button" onClick={() => removeTeam(team.id)} className="text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </CanAccess>
            </div>
            {team.vehicle && <p className="text-sm text-slate-500 mt-1">Fahrzeug: {team.vehicle.name}</p>}
            <ul className="mt-3 text-sm space-y-1">
              {team.members.map((m) => (
                <li key={m.employee.id}>
                  {m.employee.user.firstName} {m.employee.user.lastName}
                  {m.isForeman && " (Vorarbeiter)"}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
