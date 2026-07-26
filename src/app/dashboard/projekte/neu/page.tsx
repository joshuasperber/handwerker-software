"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchJson } from "@/lib/fetch-json";
import { saveJson } from "@/lib/save-toast";
import { PROJECT_STATUS_LABELS } from "@/lib/projects/types";
import { ArrowLeft } from "lucide-react";

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
}
interface Team {
  id: string;
  name: string;
}
interface Employee {
  id: string;
  user: { firstName: string; lastName: string };
}

export default function NeuesProjektPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    customerId: "",
    addressStreet: "",
    addressZip: "",
    addressCity: "",
    startDate: "",
    endDate: "",
    status: "GEPLANT",
    description: "",
    notes: "",
    teamId: "",
    employeeIds: [] as string[],
  });

  useEffect(() => {
    void Promise.all([
      fetchJson<Customer[]>("/api/customers"),
      fetchJson<Team[]>("/api/teams"),
      fetchJson<Employee[]>("/api/employees"),
    ]).then(([c, t, e]) => {
      if (c.success && c.data) setCustomers(c.data);
      if (t.success && t.data) setTeams(t.data);
      if (e.success && e.data) setEmployees(e.data);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await saveJson<{ id: string }>(
      "/api/projects",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          teamId: form.teamId || null,
          employeeIds: form.employeeIds,
        }),
      },
      { success: "Projekt angelegt" }
    );
    setSaving(false);
    if (res.success && res.data) {
      router.push(`/dashboard/projekte/${res.data.id}`);
    } else {
      setError(res.error ?? "Speichern fehlgeschlagen");
    }
  }

  function toggleEmployee(id: string) {
    setForm((f) => ({
      ...f,
      employeeIds: f.employeeIds.includes(id)
        ? f.employeeIds.filter((x) => x !== id)
        : [...f.employeeIds, id],
    }));
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/dashboard/projekte"
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Neues Projekt</h1>
        <p className="mt-1 text-sm text-slate-500">
          Größeres Vorhaben anlegen und später Aufträge, Fotos und Kosten verknüpfen
        </p>
      </div>

      <Card className="!p-5">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Projektname *</Label>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="z. B. Projekt Hausbau Friedrichstraße"
            />
          </div>

          <div className="grid gap-2">
            <Label>Kunde *</Label>
            <Select
              value={form.customerId}
              onValueChange={(v) => setForm({ ...form, customerId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Kunde wählen" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="street">Projektadresse</Label>
              <Input
                id="street"
                value={form.addressStreet}
                onChange={(e) => setForm({ ...form, addressStreet: e.target.value })}
                placeholder="Straße"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="zip">PLZ</Label>
              <Input
                id="zip"
                value={form.addressZip}
                onChange={(e) => setForm({ ...form, addressZip: e.target.value })}
              />
            </div>
            <div className="grid gap-2 sm:col-span-3">
              <Label htmlFor="city">Ort</Label>
              <Input
                id="city"
                value={form.addressCity}
                onChange={(e) => setForm({ ...form, addressCity: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="start">Startdatum</Label>
              <Input
                id="start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end">Enddatum (optional)</Label>
              <Input
                id="end"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Team (optional)</Label>
            <Select
              value={form.teamId || "__none__"}
              onValueChange={(v) =>
                setForm({ ...form, teamId: v === "__none__" ? "" : v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Kein Team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Kein Team</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {employees.length > 0 && (
            <div className="grid gap-2">
              <Label>Zuständige Mitarbeiter</Label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
                {employees.map((emp) => (
                  <label key={emp.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.employeeIds.includes(emp.id)}
                      onChange={() => toggleEmployee(emp.id)}
                    />
                    {emp.user.firstName} {emp.user.lastName}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="desc">Beschreibung</Label>
            <Textarea
              id="desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notizen</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving || !form.customerId}>
              {saving ? "Speichern …" : "Projekt anlegen"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Abbrechen
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
