"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { InfoButton } from "@/components/ui/info-button";
import { fetchJson } from "@/lib/fetch-json";
import { saveJson } from "@/lib/save-toast";
import { formatDateTime } from "@/lib/utils";
import { Bell, Clock, Receipt, PackageSearch, Play, ScrollText, Mail } from "lucide-react";

interface Settings {
  bookingConfirmationEnabled: boolean;
  bookingConfirmationEmailTemplate: string;
  appointmentReminderEnabled: boolean;
  appointmentReminderHoursBefore: number;
  remindCustomer: boolean;
  remindEmployee: boolean;
  dunningAutoEnabled: boolean;
  dunningLevel1Days: number;
  dunningLevel2Days: number;
  dunningLevel3Days: number;
  reorderCheckEnabled: boolean;
  defaultEmail: boolean;
  defaultSms: boolean;
  reminderEmailTemplate: string;
  dunningEmailTemplate: string;
}

function hoursToDaysLabel(hours: number): string {
  if (hours % 24 === 0 && hours >= 24) {
    const days = hours / 24;
    return days === 1 ? "1 Tag vorher" : `${days} Tage vorher`;
  }
  return `${hours} Stunden vorher`;
}

interface LogEntry {
  id: string;
  type: string;
  channel: string;
  recipient: string;
  subject: string | null;
  sentAt: string;
}

const EMPTY: Settings = {
  bookingConfirmationEnabled: true,
  bookingConfirmationEmailTemplate: "",
  appointmentReminderEnabled: true,
  appointmentReminderHoursBefore: 24,
  remindCustomer: true,
  remindEmployee: true,
  dunningAutoEnabled: false,
  dunningLevel1Days: 7,
  dunningLevel2Days: 14,
  dunningLevel3Days: 21,
  reorderCheckEnabled: true,
  defaultEmail: true,
  defaultSms: false,
  reminderEmailTemplate: "",
  dunningEmailTemplate: "",
};

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function BenachrichtigungenPage() {
  const [form, setForm] = useState<Settings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  function loadLogs() {
    fetchJson<LogEntry[]>("/api/notification-log").then((r) => {
      if (r.success && r.data) setLogs(r.data);
    });
  }

  useEffect(() => {
    fetchJson<Partial<Settings>>("/api/notification-settings")
      .then((r) => {
        if (r.success && r.data) {
          const d = r.data;
          setForm({
            ...EMPTY,
            ...d,
            bookingConfirmationEmailTemplate: d.bookingConfirmationEmailTemplate ?? "",
            reminderEmailTemplate: d.reminderEmailTemplate ?? "",
            dunningEmailTemplate: d.dunningEmailTemplate ?? "",
          });
        }
      })
      .finally(() => setLoading(false));
    loadLogs();
  }, []);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    await saveJson("/api/notification-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
  }

  async function runJob(job: string, label: string) {
    setRunning(job);
    const res = await saveJson<{ reports: { job: string; processed: number; skipped: number; errors: number }[] }>(
      `/api/cron/daily?jobs=${job}`,
      { method: "POST" },
      { loading: `${label} läuft …`, success: `${label} ausgeführt` }
    );
    setRunning(null);
    if (res.success && res.data?.reports?.[0]) {
      const r = res.data.reports[0];
      const { toast } = await import("sonner");
      toast.message(`${label}: ${r.processed} verarbeitet, ${r.skipped} übersprungen, ${r.errors} Fehler`);
      loadLogs();
    }
  }

  if (loading) {
    return <p className="text-slate-400">Wird geladen …</p>;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2 mb-6">
        <Bell className="h-7 w-7 text-[#0d5c63]" />
        Benachrichtigungen &amp; Automatisierung
        <InfoButton title="Wie funktioniert das?">
          <p>
            Hier steuern Sie automatische Kunden-E-Mails. Die Empfänger-Adresse wird
            immer aus dem Kundenprofil gelesen. Geplante Erinnerungen laufen täglich
            über den Server (Vercel Cron). Pro Kunde kann die Buchungsbestätigung im
            Kundenprofil individuell überschrieben werden.
          </p>
        </InfoButton>
      </h1>

      <Card className="mb-5">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2 mb-1">
          <Mail className="h-5 w-5 text-[#0d5c63]" /> Buchungsbestätigung (sofort)
        </h2>
        <p className="text-xs text-slate-500 mb-3">
          Wird direkt nach der Terminbuchung (Widget oder erster Termin im Büro) an die
          E-Mail-Adresse aus dem Kundenprofil gesendet — einmal pro Auftrag.
        </p>
        <div className="divide-y divide-slate-100">
          <Row label="Buchungsbestätigung aktiv">
            <Switch
              checked={form.bookingConfirmationEnabled}
              onCheckedChange={(v) => set("bookingConfirmationEnabled", v)}
            />
          </Row>
        </div>
        <div className="mt-3">
          <Label className="text-xs flex items-center gap-1">
            E-Mail-Vorlage (optional)
            <InfoButton title="Platzhalter">
              <p>
                Verfügbare Platzhalter: {"{{kunde}}"}, {"{{datum}}"}, {"{{auftragsnummer}}"},
                {" {{ort}}"}. Leer = Standardtext.
              </p>
            </InfoButton>
          </Label>
          <Textarea
            rows={4}
            value={form.bookingConfirmationEmailTemplate}
            onChange={(e) => set("bookingConfirmationEmailTemplate", e.target.value)}
            placeholder={"Sehr geehrte/r {{kunde}},\n\nvielen Dank für Ihre Buchung. Ihr Termin ist am {{datum}}.\n\nAuftragsnummer: {{auftragsnummer}}\n{{ort}}"}
          />
        </div>
      </Card>

      <Card className="mb-5">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2 mb-1">
          <Clock className="h-5 w-5 text-[#0d5c63]" /> Terminerinnerung (vor Termin)
        </h2>
        <p className="text-xs text-slate-500 mb-3">
          Zweite automatische E-Mail an den Kunden — standardmäßig 24 Stunden (= 1 Tag)
          vor Terminbeginn.
        </p>
        <div className="divide-y divide-slate-100">
          <Row label="Terminerinnerungen aktiv">
            <Switch
              checked={form.appointmentReminderEnabled}
              onCheckedChange={(v) => set("appointmentReminderEnabled", v)}
            />
          </Row>
          <Row
            label="Vorlaufzeit"
            hint={`${hoursToDaysLabel(form.appointmentReminderHoursBefore)} · E-Mail aus Kundenprofil`}
          >
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={form.appointmentReminderHoursBefore === 24 ? "default" : "outline"}
                size="sm"
                onClick={() => set("appointmentReminderHoursBefore", 24)}
              >
                1 Tag
              </Button>
              <Button
                type="button"
                variant={form.appointmentReminderHoursBefore === 48 ? "default" : "outline"}
                size="sm"
                onClick={() => set("appointmentReminderHoursBefore", 48)}
              >
                2 Tage
              </Button>
              <Input
                type="number"
                min={1}
                max={336}
                value={form.appointmentReminderHoursBefore}
                onChange={(e) => set("appointmentReminderHoursBefore", Number(e.target.value))}
                className="h-9 w-20"
                title="Stunden vor Termin"
              />
              <span className="text-xs text-slate-500">Std.</span>
            </div>
          </Row>
          <Row label="Kunde erinnern" hint="per E-Mail">
            <Switch checked={form.remindCustomer} onCheckedChange={(v) => set("remindCustomer", v)} />
          </Row>
          <Row label="Monteur erinnern" hint="In-App">
            <Switch checked={form.remindEmployee} onCheckedChange={(v) => set("remindEmployee", v)} />
          </Row>
        </div>
        <div className="mt-3">
          <Label className="text-xs flex items-center gap-1">
            E-Mail-Vorlage (optional)
            <InfoButton title="Platzhalter">
              <p>Verfügbare Platzhalter: {"{{kunde}}"}, {"{{datum}}"}, {"{{auftragsnummer}}"}, {"{{ort}}"}. Leer = Standardtext.</p>
            </InfoButton>
          </Label>
          <Textarea
            rows={3}
            value={form.reminderEmailTemplate}
            onChange={(e) => set("reminderEmailTemplate", e.target.value)}
            placeholder="Erinnerung an Ihren Termin am {{datum}} (Auftrag {{auftragsnummer}}) …"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={running === "reminders"}
          onClick={() => runJob("reminders", "Terminerinnerungen")}
        >
          <Play className="h-4 w-4 mr-1" /> Jetzt ausführen
        </Button>
      </Card>

      <Card className="mb-5">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2 mb-1">
          <Receipt className="h-5 w-5 text-[#0d5c63]" /> Automatisches Mahnwesen
        </h2>
        <div className="divide-y divide-slate-100">
          <Row label="Mahnlauf aktiv" hint="Erhöht Mahnstufen überfälliger Rechnungen automatisch">
            <Switch
              checked={form.dunningAutoEnabled}
              onCheckedChange={(v) => set("dunningAutoEnabled", v)}
            />
          </Row>
          <Row label="Zahlungserinnerung" hint="Tage nach Fälligkeit">
            <Input
              type="number"
              min={0}
              max={180}
              value={form.dunningLevel1Days}
              onChange={(e) => set("dunningLevel1Days", Number(e.target.value))}
              className="h-9 w-24"
            />
          </Row>
          <Row label="1. Mahnung" hint="Tage nach Fälligkeit">
            <Input
              type="number"
              min={0}
              max={180}
              value={form.dunningLevel2Days}
              onChange={(e) => set("dunningLevel2Days", Number(e.target.value))}
              className="h-9 w-24"
            />
          </Row>
          <Row label="2. Mahnung" hint="Tage nach Fälligkeit">
            <Input
              type="number"
              min={0}
              max={180}
              value={form.dunningLevel3Days}
              onChange={(e) => set("dunningLevel3Days", Number(e.target.value))}
              className="h-9 w-24"
            />
          </Row>
        </div>
        <div className="mt-3">
          <Label className="text-xs flex items-center gap-1">
            E-Mail-Vorlage (optional)
            <InfoButton title="Platzhalter">
              <p>Verfügbare Platzhalter: {"{{kunde}}"}, {"{{rechnungsnummer}}"}, {"{{betrag}}"}, {"{{gebuehr}}"}, {"{{faelligkeit}}"}, {"{{stufe}}"}, {"{{firmenname}}"}. Leer = Standardtext.</p>
            </InfoButton>
          </Label>
          <Textarea
            rows={3}
            value={form.dunningEmailTemplate}
            onChange={(e) => set("dunningEmailTemplate", e.target.value)}
            placeholder="Sehr geehrte/r {{kunde}}, zur Rechnung {{rechnungsnummer}} ist ein Betrag von {{betrag}} offen …"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={running === "dunning"}
          onClick={() => runJob("dunning", "Mahnlauf")}
        >
          <Play className="h-4 w-4 mr-1" /> Jetzt ausführen
        </Button>
      </Card>

      <Card className="mb-5">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2 mb-1">
          <PackageSearch className="h-5 w-5 text-[#0d5c63]" /> Bestellvorschläge
        </h2>
        <div className="divide-y divide-slate-100">
          <Row label="Bestand-Check aktiv" hint="Benachrichtigt den Einkauf bei Unterschreitung">
            <Switch
              checked={form.reorderCheckEnabled}
              onCheckedChange={(v) => set("reorderCheckEnabled", v)}
            />
          </Row>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={running === "reorder"}
          onClick={() => runJob("reorder", "Bestand-Check")}
        >
          <Play className="h-4 w-4 mr-1" /> Jetzt ausführen
        </Button>
      </Card>

      <Card className="mb-5">
        <h2 className="font-semibold text-slate-900 mb-1">Kanäle (Standard)</h2>
        <div className="divide-y divide-slate-100">
          <Row label="E-Mail-Versand" hint="benötigt SMTP-Konfiguration">
            <Switch checked={form.defaultEmail} onCheckedChange={(v) => set("defaultEmail", v)} />
          </Row>
          <Row label="SMS-Versand" hint="benötigt Twilio-Konfiguration">
            <Switch checked={form.defaultSms} onCheckedChange={(v) => set("defaultSms", v)} />
          </Row>
        </div>
      </Card>

      <div className="flex justify-end mb-8">
        <Button variant="action" onClick={save} disabled={saving}>
          {saving ? "Speichern …" : "Einstellungen speichern"}
        </Button>
      </div>

      <Card>
        <h2 className="font-semibold text-slate-900 flex items-center gap-2 mb-3">
          <ScrollText className="h-5 w-5 text-[#0d5c63]" /> Zustellprotokoll
          <span className="text-xs font-normal text-slate-400">letzte 50 Versände</span>
        </h2>
        {logs.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">Noch keine Versände protokolliert.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-2 pr-3">Zeitpunkt</th>
                  <th className="py-2 pr-3">Typ</th>
                  <th className="py-2 pr-3">Kanal</th>
                  <th className="py-2 pr-3">Empfänger</th>
                  <th className="py-2">Betreff</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100">
                    <td className="py-1.5 pr-3 whitespace-nowrap text-slate-500">
                      {formatDateTime(l.sentAt)}
                    </td>
                    <td className="py-1.5 pr-3">{l.type}</td>
                    <td className="py-1.5 pr-3">{l.channel}</td>
                    <td className="py-1.5 pr-3 max-w-[180px] truncate">{l.recipient}</td>
                    <td className="py-1.5 max-w-[220px] truncate text-slate-600">{l.subject ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
