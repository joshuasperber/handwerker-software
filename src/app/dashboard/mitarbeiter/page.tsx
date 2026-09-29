"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS } from "@/lib/utils";
import { CanAccess, usePermission, useSession } from "@/components/auth/can-access";
import { AddButton } from "@/components/ui/add-button";
import { saveJson } from "@/lib/save-toast";
import { swrKeys, useApiSWR } from "@/lib/swr";
import { ASSIGNABLE_STAFF_ROLES } from "@/lib/permissions";
import { Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FilterSelect, SearchField } from "@/components/ui/list-controls";
import { InfoButton } from "@/components/ui/info-button";

interface Employee {
  id: string;
  color: string;
  hourlyWageNet?: number | null;
  billingHourlyRateNet?: number | null;
  defaultActivity?: string | null;
  operationalStatus: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    phone: string | null;
    address: string | null;
    isActive: boolean;
    canManageRoles?: boolean;
  };
  qualifications: { name: string }[];
}

const ROLES = ASSIGNABLE_STAFF_ROLES;

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  role: "MONTEUR",
  phone: "",
  address: "",
  color: "#3b82f6",
  qualifications: "",
  hourlyWageNet: "",
  billingHourlyRateNet: "",
  defaultActivity: "",
  isActive: true,
  canManageRoles: false,
};

export default function MitarbeiterPage() {
  const session = useSession();
  const canManageRoles = usePermission("roles.manage");
  const canDeleteEmployees = usePermission("users.manage");
  const { data: employees = [], mutate } = useApiSWR<Employee[]>(swrKeys.employees());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("active");
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);

  const roleOptions = canManageRoles
    ? ROLES.filter((r) => r !== "ADMIN" || session.role === "ADMIN")
    : (["MONTEUR", "AUSHILFE"] as const);

  function load() {
    void mutate();
  }

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
      address: emp.user.address ?? "",
      color: emp.color,
      qualifications: emp.qualifications.map((q) => q.name).join(", "),
      hourlyWageNet: emp.hourlyWageNet != null ? String(emp.hourlyWageNet) : "",
      billingHourlyRateNet:
        emp.billingHourlyRateNet != null ? String(emp.billingHourlyRateNet) : "",
      defaultActivity: emp.defaultActivity ?? "",
      isActive: emp.user.isActive,
      canManageRoles: emp.user.canManageRoles ?? false,
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
      address: form.address || undefined,
      color: form.color,
      isActive: form.isActive,
      hourlyWageNet: form.hourlyWageNet.trim()
        ? Number(form.hourlyWageNet.replace(",", "."))
        : null,
      billingHourlyRateNet: form.billingHourlyRateNet.trim()
        ? Number(form.billingHourlyRateNet.replace(",", "."))
        : null,
      defaultActivity: form.defaultActivity.trim() || null,
      qualifications: form.qualifications
        ? form.qualifications.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      ...(canManageRoles && form.role === "BUERO"
        ? { canManageRoles: form.canManageRoles }
        : {}),
      ...(form.password ? { password: form.password } : {}),
    };

    const url = editingId ? `/api/employees/${editingId}` : "/api/employees";
    const method = editingId ? "PATCH" : "POST";
    const body = editingId
      ? payload
      : { ...payload, password: form.password || undefined };

    const data = await saveJson(
      url,
      {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      { error: "Fehler beim Speichern" }
    );
    if (data.success) {
      cancelForm();
      load();
    } else {
      setError(data.error ?? "Fehler beim Speichern");
    }
  }

  async function removeEmployee() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);

    const result = await saveJson<{
      action: "deleted" | "deactivated";
      message: string;
    }>(
      `/api/employees/${deleteTarget.id}`,
      { method: "DELETE" },
      {
        loading: "Mitarbeiter wird entfernt …",
        success: "Mitarbeiter wurde entfernt",
        error: "Mitarbeiter konnte nicht entfernt werden",
      }
    );

    if (result.success && result.data) {
      const nextEmployees =
        result.data.action === "deleted"
          ? employees.filter((employee) => employee.id !== deleteTarget.id)
          : employees.map((employee) =>
              employee.id === deleteTarget.id
                ? { ...employee, user: { ...employee.user, isActive: false } }
                : employee
            );
      await mutate(nextEmployees, { revalidate: false });
      setDeleteTarget(null);
      void mutate();
    }
    setDeleting(false);
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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          Mitarbeiter
          <InfoButton title="Mitarbeiter" ariaLabel="Info zu Mitarbeiter">
            <p>Mitarbeiter verwalten, Rollen zuweisen und aktive Zugänge filtern.</p>
          </InfoButton>
        </h1>
        <CanAccess permission="employees.write">
          <AddButton onClick={startCreate}>Mitarbeiter anlegen</AddButton>
        </CanAccess>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <SearchField
          label="Mitarbeiter durchsuchen"
          placeholder="Name oder E-Mail suchen …"
          value={search}
          onValueChange={setSearch}
        />
        <FilterSelect
          aria-label="Nach Rolle filtern"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">Alle Rollen</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
          ))}
        </FilterSelect>
        <FilterSelect
          aria-label="Nach Aktivstatus filtern"
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as typeof activeFilter)}
        >
          <option value="active">Nur aktive</option>
          <option value="all">Alle</option>
          <option value="inactive">Nur deaktivierte</option>
        </FilterSelect>
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
              label={editingId ? "Passwort zurücksetzen (leer = unverändert)" : "Initialpasswort (leer = admin1234)"}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={editingId ? "" : "admin1234"}
            />
            <div>
              <label className="text-sm font-medium">Rolle *</label>
              <select
                className="w-full h-10 rounded-lg border mt-1 px-3 text-sm"
                value={form.role}
                onChange={(e) =>
                  setForm({
                    ...form,
                    role: e.target.value,
                    canManageRoles: e.target.value === "BUERO" ? form.canManageRoles : false,
                  })
                }
                disabled={Boolean(editingId) && !canManageRoles}
              >
                {(editingId && !canManageRoles
                  ? [form.role]
                  : Array.from(new Set([...roleOptions, form.role]))
                ).map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                ))}
              </select>
              {!canManageRoles && (
                <p className="mt-1 text-xs text-slate-500">
                  Rollenänderungen nur mit Berechtigung „Rollen & Rechte verwalten“.
                </p>
              )}
            </div>
            {canManageRoles && form.role === "BUERO" && (
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.canManageRoles}
                    onChange={(e) => setForm({ ...form, canManageRoles: e.target.checked })}
                  />
                  Darf Rollen und Rechte verwalten
                </label>
              </div>
            )}
            <Input label="Telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="Adresse" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="sm:col-span-2" />
            <Input
              label="Interner Stundenlohn netto (€)"
              inputMode="decimal"
              value={form.hourlyWageNet}
              onChange={(e) => setForm({ ...form, hourlyWageNet: e.target.value })}
              placeholder="z. B. 28,50 – nur intern"
            />
            <Input
              label="Verrechnungssatz netto (€)"
              inputMode="decimal"
              value={form.billingHourlyRateNet}
              onChange={(e) => setForm({ ...form, billingHourlyRateNet: e.target.value })}
              placeholder="z. B. 68 – für Kalkulation/Rechnung"
            />
            <Input
              label="Standardtätigkeit"
              value={form.defaultActivity}
              onChange={(e) => setForm({ ...form, defaultActivity: e.target.value })}
              placeholder="z. B. Montagearbeiten"
              className="sm:col-span-2"
            />
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
                  {emp.user.canManageRoles && emp.user.role === "BUERO" && (
                    <span className="text-xs text-[#0d5c63]">Rollenverwaltung</span>
                  )}
                  {!emp.user.isActive && (
                    <span className="text-xs text-red-500">Deaktiviert</span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <CanAccess permission="employees.write">
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-10 min-w-10"
                    onClick={() => startEdit(emp)}
                    aria-label={`${emp.user.firstName} ${emp.user.lastName} bearbeiten`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </CanAccess>
                {canDeleteEmployees && emp.user.id !== session.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-10 min-w-10 text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setDeleteTarget(emp)}
                    aria-label={`${emp.user.firstName} ${emp.user.lastName} entfernen`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-400">{emp.user.email}</p>
            {emp.hourlyWageNet != null && (
              <p className="mt-1 text-xs text-slate-500">
                Intern: {emp.hourlyWageNet.toFixed(2)} €/Std.
                {emp.billingHourlyRateNet != null
                  ? ` · Verrechnung: ${emp.billingHourlyRateNet.toFixed(2)} €/Std.`
                  : ""}
              </p>
            )}
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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
        title="Mitarbeiter entfernen?"
        description={
          deleteTarget ? (
            <>
              <strong>{deleteTarget.user.firstName} {deleteTarget.user.lastName}</strong> wird
              entfernt. Ein unbenutztes Konto wird vollständig gelöscht. Sobald bereits
              Aufträge, Zeiten oder andere Vorgänge vorhanden sind, wird das Konto stattdessen
              sicher deaktiviert und die Historie bleibt erhalten.
            </>
          ) : undefined
        }
        confirmLabel="Mitarbeiter entfernen"
        variant="destructive"
        loading={deleting}
        onConfirm={removeEmployee}
        icon={<Trash2 className="h-5 w-5" />}
      />
    </div>
  );
}
