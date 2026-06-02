"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS } from "@/lib/utils";
import { CanAccess } from "@/components/auth/can-access";
import { Pencil, Plus, Search } from "lucide-react";

interface Employee {
  id: string;
  color: string;
  operationalStatus: string;
  user: { firstName: string; lastName: string; email: string; role: string; phone: string | null; isActive: boolean };
  qualifications: { name: string }[];
}

const ROLES = ["MONTEUR", "MEISTER", "BUERO", "ADMIN"];

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  role: "MONTEUR",
  phone: "",
  color: "#3b82f6",
  qualifications: "",
  isActive: true,
};

export default function MitarbeiterPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("active");

  function load() {
    fetch("/api/employees").then((r) => r.json()).then((d) => {
      if (d.success) setEmployees(d.data);
    });
  }

  useEffect(() => { load(); }, []);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  }

  function startEdit(emp: Employee) {
    setEditingId(emp.id);
    setForm({
      firstName: emp.user.firstName,
      lastName: emp.user.lastName,
      email: emp.user.email,
      password: "",
      role: emp.user.role,
      phone: emp.user.phone ?? "",
      color: emp.color,
      qualifications: emp.qualifications.map((q) => q.name).join(", "),
      isActive: emp.user.isActive,
    });
    setError("");
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const payload = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      role: form.role,
      phone: form.phone || undefined,
      color: form.color,
      isActive: form.isActive,
      qualifications: form.qualifications
        ? form.qualifications.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      ...(form.password ? { password: form.password } : {}),
    };

    const url = editingId ? `/api/employees/${editingId}` : "/api/employees";
    const method = editingId ? "PATCH" : "POST";
    const body = editingId
      ? payload
      : { ...payload, password: form.password || undefined };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.success) {
      cancelForm();
      load();
    } else {
      setError(data.error ?? "Fehler beim Speichern");
    }
  }

  const filtered = employees.filter((emp) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      emp.user.firstName.toLowerCase().includes(q) ||
      emp.user.lastName.toLowerCase().includes(q) ||
      emp.user.email.toLowerCase().includes(q);
    const matchesRole = !roleFilter || emp.user.role === roleFilter;
    const matchesActive =
      activeFilter === "all" ||
      (activeFilter === "active" && emp.user.isActive) ||
      (activeFilter === "inactive" && !emp.user.isActive);
    return matchesSearch && matchesRole && matchesActive;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Mitarbeiter</h1>
        <CanAccess permission="employees.write">
          <Button size="lg" variant="action" onClick={startCreate}>
            <Plus className="h-5 w-5" /> Mitarbeiter anlegen
          </Button>
        </CanAccess>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Name oder E-Mail suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-300 text-sm"
          />
        </div>
        <select
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">Alle Rollen</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
          ))}
        </select>
        <select
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as typeof activeFilter)}
        >
          <option value="active">Nur aktive</option>
          <option value="all">Alle</option>
          <option value="inactive">Nur deaktivierte</option>
        </select>
      </div>

      <CanAccess permission="employees.write">
      {showForm && (
        <Card title={editingId ? "Mitarbeiter bearbeiten" : "Neuer Mitarbeiter"} className="mb-6">
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <Input label="Vorname *" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            <Input label="Nachname *" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
            <Input label="E-Mail (Login) *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <Input
              label={editingId ? "Neues Passwort (leer = unverändert)" : "Passwort (leer = demo1234)"}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={editingId ? "" : "demo1234"}
            />
            <div>
              <label className="text-sm font-medium">Rolle *</label>
              <select className="w-full h-10 rounded-lg border mt-1 px-3 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                ))}
              </select>
            </div>
            <Input label="Telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <div>
              <label className="text-sm font-medium">Kalenderfarbe</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10 w-14 rounded border cursor-pointer" />
                <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="flex-1" />
              </div>
            </div>
            {editingId && (
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                  Konto aktiv
                </label>
              </div>
            )}
            <Input label="Qualifikationen (kommagetrennt)" value={form.qualifications} onChange={(e) => setForm({ ...form, qualifications: e.target.value })} className="sm:col-span-2" placeholder="Sanitär, Elektro" />
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" variant="action">{editingId ? "Speichern" : "Anlegen"}</Button>
              <Button type="button" variant="outline" onClick={cancelForm}>Abbrechen</Button>
            </div>
          </form>
        </Card>
      )}
      </CanAccess>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((emp) => (
          <Card key={emp.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white font-medium"
                  style={{ backgroundColor: emp.color }}
                >
                  {emp.user.firstName.charAt(0)}{emp.user.lastName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{emp.user.firstName} {emp.user.lastName}</h3>
                  <p className="text-sm text-slate-500">{ROLE_LABELS[emp.user.role]}</p>
                  {!emp.user.isActive && (
                    <span className="text-xs text-red-500">Deaktiviert</span>
                  )}
                </div>
              </div>
              <CanAccess permission="employees.write">
                <Button size="sm" variant="outline" onClick={() => startEdit(emp)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </CanAccess>
            </div>
            <p className="mt-3 text-sm text-slate-400">{emp.user.email}</p>
            {emp.qualifications.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {emp.qualifications.map((q) => (
                  <span key={q.name} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {q.name}
                  </span>
                ))}
              </div>
            )}
          </Card>
        ))}
        {!filtered.length && (
          <p className="text-sm text-slate-500 col-span-full text-center py-8">Keine Mitarbeiter gefunden.</p>
        )}
      </div>
    </div>
  );
}
