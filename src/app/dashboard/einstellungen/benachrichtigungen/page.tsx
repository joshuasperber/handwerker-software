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
import { Clock, Receipt, PackageSearch, Play, ScrollText, Mail, Smartphone } from "lucide-react";
import { SettingsPageHeader } from "@/components/dashboard/settings-page-header";

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
  messagingMode: "SMS" | "WHATSAPP";
  reminderEmailTemplate: string;
  reminderSmsTemplate: string;
  dunningEmailTemplate: string;
  messagingLastTestAt: string | null;
  messagingLastTestStatus: string | null;
  messagingLastTestError: string | null;
  messagingLastTestChannel: string | null;
}

type ChannelRuntime = {
  configured: boolean;
  missing: string[];
  fromMasked?: string | null;
  messagingServiceMasked?: string | null;
  whatsappFromMasked?: string | null;
  provider?: string;
  dryRun?: boolean;
  emptyDeclared?: boolean;
};

type RuntimeStatus = {
  email: ChannelRuntime;
  messaging: ChannelRuntime;
};

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
  status?: string;
  errorMessage?: string | null;
  retryable?: boolean;
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
  messagingMode: "SMS",
  reminderEmailTemplate: "",
  reminderSmsTemplate: "",
  dunningEmailTemplate: "",
  messagingLastTestAt: null,
  messagingLastTestStatus: null,
  messagingLastTestError: null,
  messagingLastTestChannel: null,
};

const TEST_PHONE_KEY = "jomaster.messagingTestPhone";
const DEFAULT_TEST_PHONE = "+4915259655035";
const LEGACY_TEST_PHONES = new Set([
  "+491525965035",
  "+49152596503",
  "491525965035",
  "+4915888623971",
]);

const STATUS_LABELS: Record<string, string> = {
  SENT: "Gesendet",
  FAILED: "Fehlgeschlagen",
  NO_CONTACT: "Keine Kontaktdaten",
  INVALID_PHONE: "Ungültige Telefonnummer",
  DISABLED: "Deaktiviert",
  ALREADY_SENT: "Bereits gesendet",
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
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [testChannel, setTestChannel] = useState<"EMAIL" | "SMS" | "WHATSAPP">("SMS");
  const [testPhone, setTestPhone] = useState(DEFAULT_TEST_PHONE);
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  function loadLogs() {
    fetchJson<LogEntry[]>("/api/notification-log").then((r) => {
      if (r.success && r.data) setLogs(r.data);
    });
  }

  useEffect(() => {
    Promise.all([
      fetchJson<RuntimeStatus>("/api/notification-settings/runtime"),
      fetchJson<Partial<Settings> & { runtime?: RuntimeStatus }>("/api/notification-settings"),
    ])
      .then(([runtimeRes, settingsRes]) => {
        if (runtimeRes.success && runtimeRes.data) {
          setRuntime(runtimeRes.data);
        } else if (settingsRes.success && settingsRes.data?.runtime) {
          setRuntime(settingsRes.data.runtime);
        }
        if (settingsRes.success && settingsRes.data) {
          const d = settingsRes.data;
          setForm({
            ...EMPTY,
            ...d,
            bookingConfirmationEmailTemplate: d.bookingConfirmationEmailTemplate ?? "",
            reminderEmailTemplate: d.reminderEmailTemplate ?? "",
            reminderSmsTemplate: d.reminderSmsTemplate ?? "",
            dunningEmailTemplate: d.dunningEmailTemplate ?? "",
            messagingMode: d.messagingMode === "WHATSAPP" ? "WHATSAPP" : "SMS",
            messagingLastTestAt: d.messagingLastTestAt ?? null,
            messagingLastTestStatus: d.messagingLastTestStatus ?? null,
            messagingLastTestError: d.messagingLastTestError ?? null,
            messagingLastTestChannel: d.messagingLastTestChannel ?? null,
          });
        }
      })
      .finally(() => setLoading(false));
    const stored = window.localStorage.getItem(TEST_PHONE_KEY);
    if (stored && !LEGACY_TEST_PHONES.has(stored.trim())) {
      setTestPhone(stored);
    } else {
      setTestPhone(DEFAULT_TEST_PHONE);
      window.localStorage.setItem(TEST_PHONE_KEY, DEFAULT_TEST_PHONE);
    }
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
      body: JSON.stringify({
        bookingConfirmationEnabled: form.bookingConfirmationEnabled,
        bookingConfirmationEmailTemplate: form.bookingConfirmationEmailTemplate,
        appointmentReminderEnabled: form.appointmentReminderEnabled,
        appointmentReminderHoursBefore: form.appointmentReminderHoursBefore,
        remindCustomer: form.remindCustomer,
        remindEmployee: form.remindEmployee,
        dunningAutoEnabled: form.dunningAutoEnabled,
        dunningLevel1Days: form.dunningLevel1Days,
        dunningLevel2Days: form.dunningLevel2Days,
        dunningLevel3Days: form.dunningLevel3Days,
        reorderCheckEnabled: form.reorderCheckEnabled,
        defaultEmail: form.defaultEmail,
        defaultSms: form.defaultSms,
        messagingMode: form.messagingMode,
        reminderEmailTemplate: form.reminderEmailTemplate,
        reminderSmsTemplate: form.reminderSmsTemplate,
        dunningEmailTemplate: form.dunningEmailTemplate,
      }),
    });
    if (testPhone.trim()) {
      window.localStorage.setItem(TEST_PHONE_KEY, testPhone.trim());
    }
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

  async function sendTest() {
    setTesting(true);
    setTestResult(null);
    const res = await saveJson<{
      sent: boolean;
      status: string;
      channel: string;
      error: string | null;
    }>(
      "/api/notification-settings/test",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: testChannel,
          phone: testPhone,
          email: testEmail,
          template: "reminder",
        }),
      },
      {
        loading: "Testnachricht wird gesendet …",
        success: "Test abgeschlossen",
        error: "Testversand fehlgeschlagen",
      }
    );
    setTesting(false);
    if (testPhone.trim()) {
      window.localStorage.setItem(TEST_PHONE_KEY, testPhone.trim());
    }
    if (res.success && res.data) {
      const status = STATUS_LABELS[res.data.status] ?? res.data.status;
      setTestResult(
        res.data.sent
          ? `Erfolgreich gesendet über ${res.data.channel} (${status}).`
          : `Fehlgeschlagen über ${res.data.channel}: ${res.data.error ?? status}`
      );
      setForm((f) => ({
        ...f,
        messagingLastTestAt: new Date().toISOString(),
        messagingLastTestStatus: res.data!.status,
        messagingLastTestError: res.data!.error,
        messagingLastTestChannel: res.data!.channel,
      }));
      loadLogs();
    } else {
      setTestResult(res.error ?? "Testversand fehlgeschlagen.");
    }
  }

  if (loading) {
    return <p className="text-slate-400">Wird geladen …</p>;
  }

  return (
    <div className="max-w-3xl">
      <SettingsPageHeader href="/dashboard/einstellungen/benachrichtigungen" />

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
          Automatische Erinnerung an den Kunden — standardmäßig 24 Stunden vor Terminbeginn.
          Der Kanal wird anhand der Kontaktdaten gewählt: nur E-Mail → E-Mail, nur Telefon →
          Nachricht/SMS, beides → bevorzugt Nachricht/SMS.
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
            hint={`${hoursToDaysLabel(form.appointmentReminderHoursBefore)} · stündlich per Cron, Zeitzone Europe/Berlin`}
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
          <Row label="Kunde erinnern" hint="E-Mail oder SMS, je nach Kontaktdaten">
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
              <p>
                Verfügbare Platzhalter: {"{{kundenname}}"}, {"{{betriebsname}}"}, {"{{datum}}"},
                {" {{uhrzeit}}"}, {"{{adresse}}"}, {"{{auftrag}}"}. Leer = Standardtext.
              </p>
            </InfoButton>
          </Label>
          <Textarea
            rows={3}
            value={form.reminderEmailTemplate}
            onChange={(e) => set("reminderEmailTemplate", e.target.value)}
            placeholder="Guten Tag {{kundenname}}, wir erinnern Sie an Ihren Termin am {{datum}} um {{uhrzeit}}. Ihr Betrieb: {{betriebsname}}."
          />
        </div>
        <div className="mt-3">
          <Label className="text-xs flex items-center gap-1">
            SMS-/Nachrichtenvorlage (optional)
            <InfoButton title="Platzhalter">
              <p>Dieselbe Platzhalter-Liste wie bei der E-Mail. Leer = Standardtext.</p>
            </InfoButton>
          </Label>
          <Textarea
            rows={2}
            value={form.reminderSmsTemplate}
            onChange={(e) => set("reminderSmsTemplate", e.target.value)}
            placeholder="Erinnerung: Ihr Termin mit {{betriebsname}} ist am {{datum}} um {{uhrzeit}}."
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
          <Row
            label="E-Mail-Versand"
            hint={
              runtime?.email.configured
                ? "SMTP konfiguriert"
                : `nicht konfiguriert${runtime?.email.missing?.length ? ` · fehlt: ${runtime.email.missing.join(", ")}` : " · SMTP_HOST"}`
            }
          >
            <Switch checked={form.defaultEmail} onCheckedChange={(v) => set("defaultEmail", v)} />
          </Row>
          <Row
            label="SMS-/Nachrichtenversand"
            hint={
              runtime?.messaging.dryRun
                ? "Testmodus (MESSAGING_DRY_RUN)"
                : runtime?.messaging.configured
                  ? `Anbieter: ${runtime.messaging.provider === "seven" ? "seven.io" : runtime.messaging.provider}`
                  : `nicht konfiguriert${runtime?.messaging.missing?.length ? ` · fehlt: ${runtime.messaging.missing.join(", ")}` : ""}`
            }
          >
            <Switch checked={form.defaultSms} onCheckedChange={(v) => set("defaultSms", v)} />
          </Row>
          <Row label="Nachrichtenkanal" hint="SMS über seven.io">
            <select
              className="h-9 rounded-lg border border-slate-200 px-2 text-sm"
              value={form.messagingMode}
              onChange={(e) => set("messagingMode", e.target.value as "SMS" | "WHATSAPP")}
            >
              <option value="SMS">SMS</option>
              <option value="WHATSAPP">WhatsApp</option>
            </select>
          </Row>
        </div>
      </Card>

      <Card className="mb-5">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2 mb-1">
          <Smartphone className="h-5 w-5 text-[#0d5c63]" /> Messaging-Anbieter
        </h2>
        <p className="text-xs text-slate-500 mb-3">
          Schlüssel bleiben auf dem Server (Vercel Environment Variables). Es werden nur
          Maskierungen und fehlende Namen angezeigt, niemals Auth-Token.
        </p>
        <div className="space-y-1.5 text-sm text-slate-700">
          <p>Anbieter: <strong>{runtime?.messaging.provider === "seven" ? "seven.io" : "nicht gesetzt"}</strong></p>
          <p>
            Absendername (SEVEN_SMS_FROM):{" "}
            <strong>{runtime?.messaging.fromMasked ?? "—"}</strong>
          </p>
          {runtime?.messaging.missing?.length ? (
            <p className="text-amber-700">
              {runtime.messaging.emptyDeclared
                ? "SEVEN_API_KEY in handwerker-app/.env ist leer. Key eintragen, speichern und den Dev-Server neu starten."
                : `Fehlende Umgebungsvariablen: ${runtime.messaging.missing.join(", ")}`}
            </p>
          ) : runtime?.messaging.configured ? (
            <p className="text-emerald-700">Erforderliche Messaging-Variablen sind gesetzt.</p>
          ) : (
            <p className="text-amber-700">
              Messaging-Status konnte nicht geladen werden. Dev-Server neu starten und die Seite neu laden.
            </p>
          )}
          <p className="text-xs text-slate-500">
            Letzter Test:{" "}
            {form.messagingLastTestAt
              ? `${formatDateTime(form.messagingLastTestAt)} · ${STATUS_LABELS[form.messagingLastTestStatus ?? ""] ?? form.messagingLastTestStatus ?? "—"} · ${form.messagingLastTestChannel ?? "—"}`
              : "noch keiner"}
          </p>
          {form.messagingLastTestError ? (
            <p className="text-sm text-red-600">{form.messagingLastTestError}</p>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Die Testnummer ist der <strong>Empfänger</strong> (Ihre Handynummer mit +49).
          Der Absendername kommt aus der .env (SEVEN_SMS_FROM).
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Kanal</Label>
            <select
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
              value={testChannel}
              onChange={(e) => setTestChannel(e.target.value as "EMAIL" | "SMS" | "WHATSAPP")}
            >
              <option value="SMS">SMS</option>
              <option value="EMAIL">E-Mail</option>
            </select>
          </div>
          {testChannel === "EMAIL" ? (
            <Input
              label="Test-E-Mail"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
            />
          ) : (
            <Input
              label="Test-Empfänger (Ihre Handynummer)"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="+4917612345678"
            />
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={testing}
          onClick={() => void sendTest()}
        >
          Test senden
        </Button>
        {testResult ? <p className="mt-2 text-sm text-slate-700">{testResult}</p> : null}
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
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Empfänger</th>
                  <th className="py-2">Betreff / Fehler</th>
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
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      {STATUS_LABELS[l.status ?? "SENT"] ?? l.status ?? "Gesendet"}
                      {l.retryable ? " · erneut möglich" : ""}
                    </td>
                    <td className="py-1.5 pr-3 max-w-[180px] truncate">{l.recipient}</td>
                    <td className="py-1.5 max-w-[220px] truncate text-slate-600">
                      {l.errorMessage || l.subject || "—"}
                    </td>
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
