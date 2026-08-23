"use client";

import Link from "next/link";
import { Bot, MessageSquare, Shield, Database } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SettingsPageHeader } from "@/components/dashboard/settings-page-header";
import { useSession } from "@/components/auth/can-access";
import { hasPermission, type Permission } from "@/lib/permissions";

const DATA_AREAS: { permission: Permission; label: string; detail: string }[] = [
  { permission: "customers.read", label: "Kunden", detail: "Namen, Kontakte, Auftragsbezüge" },
  { permission: "orders.read", label: "Aufträge & Termine", detail: "Status, Einsatzorte, Planungen" },
  { permission: "invoices.read", label: "Rechnungen & Finanzen", detail: "Offene Beträge, Umsatzübersichten" },
  { permission: "employees.read", label: "Mitarbeiter", detail: "Namen, Rollen, Verfügbarkeit" },
  { permission: "inventory.read", label: "Inventar", detail: "Bestände und Material" },
  { permission: "ai.chat", label: "Chatverlauf", detail: "Ihre Fragen an den Assistenten (betriebsintern gespeichert)" },
];

export default function AssistentEinstellungenPage() {
  const session = useSession();

  return (
    <div className="mx-auto max-w-3xl">
      <SettingsPageHeader href="/dashboard/einstellungen/assistent" />

      <div className="space-y-4">
        <Card title="Assistent öffnen" className="!p-4">
          <p className="mb-3 text-sm text-slate-600">
            Der Betriebsassistent beantwortet Fragen zu Ihren Betriebsdaten. Er erfindet keine
            Zahlen und sieht nur, was Ihre Rolle in der App bereits sehen darf.
          </p>
          <Button asChild variant="action">
            <Link href="/dashboard/ki-assistent">
              <MessageSquare className="mr-1.5 h-4 w-4" />
              Zum Betriebsassistenten
            </Link>
          </Button>
        </Card>

        <Card title="Datenzugriff nach Ihrer Rolle" className="!p-4">
          <p className="mb-4 text-sm text-slate-600">
            Der Zugriff folgt denselben Rechten wie in der übrigen App. Rollen ändern Sie unter{" "}
            <Link href="/dashboard/einstellungen/rollen" className="text-[#0d5c63] underline">
              Rollen & Rechte
            </Link>
            , die Zuweisung am Mitarbeiterkonto.
          </p>
          <ul className="space-y-2">
            {DATA_AREAS.map((area) => {
              const allowed = hasPermission(session.role, area.permission, {
                canManageRoles: session.canManageRoles,
              });
              return (
                <li
                  key={area.permission}
                  className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-800">{area.label}</p>
                    <p className="text-xs text-slate-500">{area.detail}</p>
                  </div>
                  <span
                    className={
                      allowed
                        ? "shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800"
                        : "shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500"
                    }
                  >
                    {allowed ? "erlaubt" : "nicht erlaubt"}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="Datenschutz" className="!p-4">
          <div className="space-y-2 text-sm text-slate-600">
            <p className="flex items-start gap-2">
              <Database className="mt-0.5 h-4 w-4 shrink-0 text-[#0d5c63]" />
              Chatverläufe werden in Ihrem Betriebskonto gespeichert. Es wird keine E-Mail nur
              deshalb versendet, weil Sie den Assistenten nutzen.
            </p>
            <p className="flex items-start gap-2">
              <Bot className="mt-0.5 h-4 w-4 shrink-0 text-[#0d5c63]" />
              Je nach Konfiguration kann der Anfragetext an einen KI-Anbieter übermittelt werden.
              Details stehen unter Sicherheit & Datenschutz.
            </p>
            <p className="flex items-start gap-2">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[#0d5c63]" />
              Monteure sehen nur eigene Termine und Mitnahmelisten, kein gesamtes Büro.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/dashboard/einstellungen/sicherheit">Zu Sicherheit & Datenschutz</Link>
          </Button>
        </Card>
      </div>
    </div>
  );
}
