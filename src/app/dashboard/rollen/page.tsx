"use client";

import { Shield } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/utils";
import {
  ASSIGNABLE_STAFF_ROLES,
  getPermissions,
  type Permission,
} from "@/lib/permissions";
import { CanAccess, useSession } from "@/components/auth/can-access";
import Link from "next/link";

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Shield className="h-7 w-7 text-[#0d5c63]" />
          Rollen & Rechte
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Standardrollen und ihre Berechtigungen. Zuweisung erfolgt unter{" "}
          <Link href="/dashboard/mitarbeiter" className="text-[#0d5c63] underline">
            Mitarbeiter
          </Link>
          .
        </p>
        {session.role === "BUERO" && (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Sie verwalten Rollen mit ausdrücklicher Freigabe (`canManageRoles`).
          </p>
        )}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card title="Ansichtslogik">
          <ul className="space-y-2 text-sm text-slate-700">
            <li>
              <strong>views.management</strong> → Verwaltungsansicht (/dashboard): Admin, Büro, Meister
            </li>
            <li>
              <strong>views.work</strong> → Arbeitsansicht (/monteur): Monteur, Teamleiter, Aushilfe (+ Office)
            </li>
            <li>
              Monteure starten immer in der Arbeitsansicht und kommen nicht in die Admin-Seitenleiste.
            </li>
            <li>
              Ansichtwechsel nur über bewussten Button, wenn beide Rechte vorhanden sind.
            </li>
          </ul>
        </Card>
        <Card title="Büro mit Rollenverwaltung">
          <p className="text-sm text-slate-700">
            Für Büro-Nutzer kann unter Mitarbeiter die Option{" "}
            <strong>Darf Rollen und Rechte verwalten</strong> gesetzt werden. Ohne dieses
            Recht bleibt der Bereich Rollen & Rechte gesperrt; Stammdaten (Kunden, Aufträge)
            bleiben nutzbar.
          </p>
        </Card>
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
                  <span className="rounded-full bg-[#0d5c63]/10 px-2.5 py-1 text-xs text-[#0d5c63]">
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
