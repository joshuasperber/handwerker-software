"use client";

import Link from "next/link";
import { UserPlus, ListChecks, KeyRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/utils";
import {
  ASSIGNABLE_STAFF_ROLES,
  getPermissions,
  type Permission,
} from "@/lib/permissions";
import { CanAccess, useSession } from "@/components/auth/can-access";
import { SettingsPageHeader } from "@/components/dashboard/settings-page-header";

const PERMISSION_LABELS: Partial<Record<Permission, string>> = {
  "roles.manage": "Rollen & Rechte verwalten",
  "users.manage": "Nutzerverwaltung",
  "tenant.manage": "Betriebseinstellungen",
  "customers.read": "Kunden sehen",
  "customers.write": "Kunden bearbeiten",
  "orders.read": "Aufträge sehen",
  "orders.write": "Aufträge bearbeiten",
  "orders.assign": "Aufträge zuweisen",
  "appointments.read": "Termine sehen",
  "appointments.write": "Termine planen",
  "employees.read": "Mitarbeiter sehen",
  "employees.write": "Mitarbeiter bearbeiten",
  "invoices.read": "Rechnungen sehen",
  "invoices.write": "Rechnungen bearbeiten",
  "calculations.read": "Kalkulation sehen",
  "calculations.write": "Kalkulation bearbeiten",
  "inventory.read": "Inventar sehen",
  "inventory.write": "Inventar bearbeiten",
  "time_entries.read": "Team-Zeiten sehen",
  "time_entries.approve": "Zeiten prüfen",
  "monteur.own": "Arbeitsansicht / eigene Daten",
  "ai.chat": "Betriebsassistent",
  "work_requests.create": "Arbeitsmeldungen erfassen",
  "work_requests.manage": "Eingangsbox bearbeiten",
  "messages.read": "Nachrichten lesen",
  "messages.write": "Nachrichten schreiben",
};

const HIGHLIGHT: Permission[] = [
  "roles.manage",
  "customers.read",
  "orders.read",
  "orders.write",
  "invoices.read",
  "employees.write",
  "time_entries.approve",
  "monteur.own",
  "work_requests.manage",
  "ai.chat",
];

export default function RollenRechtePage() {
  const session = useSession();

  return (
    <CanAccess
      permission="roles.manage"
      fallback={
        <Card>
          <p className="text-sm text-slate-600">
            Keine Berechtigung für Rollen & Rechte. Ein Administrator kann für Büro-Konten
            „Darf Rollen und Rechte verwalten“ aktivieren.
          </p>
        </Card>
      }
    >
      <SettingsPageHeader href="/dashboard/einstellungen/rollen" />

      {session.role === "BUERO" && (
        <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Sie verwalten Rollen mit ausdrücklicher Freigabe durch einen Administrator.
        </p>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card title="Rollen verwalten" className="!p-4">
          <p className="text-sm text-slate-600">
            Jede Rolle hat feste Rechte im System. Die Übersicht unten zeigt, was Admin, Büro,
            Meister und Monteure dürfen.
          </p>
        </Card>
        <Card title="Nutzer Rollen zuweisen" className="!p-4">
          <p className="mb-3 text-sm text-slate-600">
            Rollen werden am Mitarbeiterkonto vergeben. Büro-Konten können zusätzlich die
            Rollenverwaltung erhalten.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/mitarbeiter">
              <UserPlus className="mr-1.5 h-4 w-4" />
              Zu den Mitarbeitern
            </Link>
          </Button>
        </Card>
        <Card title="Berechtigungen prüfen" className="!p-4">
          <p className="text-sm text-slate-600">
            Vergleichen Sie unten die wichtigsten Rechte je Rolle. Einzelrechte sind an die Rolle
            gebunden und werden nicht frei kombiniert.
          </p>
        </Card>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card title="Ansichtslogik">
          <ul className="space-y-2 text-sm text-slate-700">
            <li>
              <strong>Verwaltung</strong> (/dashboard): Admin, Büro, Meister
            </li>
            <li>
              <strong>Arbeit</strong> (/monteur): Monteur, Teamleiter, Aushilfe (Office kann wechseln)
            </li>
            <li>Monteure starten in der Arbeitsansicht und sehen die Admin-Leiste nicht.</li>
            <li>Ein Wechsel der Ansicht erfolgt nur über den bewussten Umschalter.</li>
          </ul>
        </Card>
        <Card title="Rechte vergeben">
          <p className="text-sm text-slate-700">
            Rechte folgen der gewählten Rolle. Zusätzlich kann unter Mitarbeiter für Büro die Option{" "}
            <strong>Darf Rollen und Rechte verwalten</strong> gesetzt werden. Ohne dieses Recht bleibt
            dieser Reiter gesperrt.
          </p>
        </Card>
      </div>

      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <ListChecks className="h-4 w-4 text-[#0d5c63]" />
        Rechte je Rolle
      </div>

      <div className="space-y-4">
        {ASSIGNABLE_STAFF_ROLES.map((role) => {
          const perms = getPermissions(role);
          const shown = HIGHLIGHT.filter((p) => perms.includes(p));
          return (
            <Card key={role} title={ROLE_LABELS[role] ?? role}>
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">{role}</p>
              <div className="flex flex-wrap gap-2">
                {shown.map((p) => (
                  <span
                    key={p}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                  >
                    {PERMISSION_LABELS[p] ?? p}
                  </span>
                ))}
                {role === "BUERO" && (
                  <span className="rounded-full bg-[#0d5c63]/10 px-2.5 py-1 text-xs text-[#0d5c63]">
                    Rollenverwaltung nur mit Freigabe
                  </span>
                )}
                {role === "ADMIN" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#0d5c63]/10 px-2.5 py-1 text-xs text-[#0d5c63]">
                    <KeyRound className="h-3 w-3" />
                    {PERMISSION_LABELS["roles.manage"]}
                  </span>
                )}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {perms.length} Berechtigungen insgesamt (fest im System hinterlegt)
              </p>
            </Card>
          );
        })}
      </div>
    </CanAccess>
  );
}
