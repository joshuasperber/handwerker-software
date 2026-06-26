"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, RefreshCw, Server, Database, Mail, HardDrive, Clock } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface HealthCheck {
  status: string;
  latencyMs?: number;
  message?: string;
}

interface JobRunRow {
  id: string;
  jobName: string;
  trigger: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  tenantCount: number | null;
  processed: number;
  skipped: number;
  errors: number;
  errorMessage: string | null;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    ok: "VERFUEGBAR",
    error: "KRANK",
    degraded: "IM_TERMIN",
    skipped: "DRAFT",
    COMPLETED: "VERFUEGBAR",
    PARTIAL: "IM_TERMIN",
    FAILED: "KRANK",
    RUNNING: "IM_TERMIN",
  };
  const label: Record<string, string> = {
    ok: "OK",
    error: "Fehler",
    degraded: "Eingeschränkt",
    skipped: "—",
    COMPLETED: "OK",
    PARTIAL: "Teilweise",
    FAILED: "Fehlgeschlagen",
    RUNNING: "Läuft",
  };
  return <Badge status={map[status] ?? "DRAFT"} label={label[status] ?? status} />;
}

export default function SystemStatusPage() {
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<{
    ok: boolean;
    checks: Record<string, HealthCheck>;
    config: Record<string, boolean>;
    lastJobRun?: JobRunRow | null;
  } | null>(null);
  const [runs, setRuns] = useState<JobRunRow[]>([]);

  function applySystemData(d: { success?: boolean; data?: { health: typeof health; recentRuns: JobRunRow[] } }) {
    if (d.success && d.data) {
      setHealth(d.data.health);
      setRuns(d.data.recentRuns);
    }
  }

  function load() {
    setLoading(true);
    fetch("/api/admin/system")
      .then((r) => r.json())
      .then(applySystemData)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/system")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) applySystemData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function triggerCron() {
    const res = await fetch("/api/cron/daily", { method: "POST" });
    const data = await res.json();
    if (data.success) {
      load();
      return;
    }
    alert(data.error ?? "Cron fehlgeschlagen");
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/dashboard/einstellungen/benachrichtigungen" className="text-sm text-[#0d5c63] flex items-center gap-1 mb-4">
        <ChevronLeft className="h-4 w-4" /> Einstellungen
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Server className="h-7 w-7 text-[#0d5c63]" /> Systemstatus
          </h1>
          <p className="text-sm text-slate-500 mt-1">Betrieb, Cron-Jobs und Infrastruktur-Checks</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Aktualisieren
        </Button>
      </div>

      {health && (
        <Card title="Gesamtstatus" className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            {statusBadge(health.ok ? "ok" : "degraded")}
            <span className="text-sm text-slate-600">
              {health.ok ? "Alle kritischen Checks bestanden" : "Mindestens ein Check meldet Probleme"}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <CheckRow icon={<Database className="h-4 w-4" />} label="Datenbank" check={health.checks.database} />
            <CheckRow icon={<HardDrive className="h-4 w-4" />} label="Datei-Speicher (S3)" check={health.checks.storage} />
            <CheckRow icon={<Mail className="h-4 w-4" />} label="E-Mail (SMTP)" check={health.checks.smtp} />
            <CheckRow icon={<Clock className="h-4 w-4" />} label="Geplante Jobs (Cron)" check={health.checks.cron} />
          </div>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            <div><dt className="text-slate-500">CRON_SECRET</dt><dd>{health.config.cronSecretSet ? "gesetzt" : "fehlt"}</dd></div>
            <div><dt className="text-slate-500">S3</dt><dd>{health.config.s3Configured ? "konfiguriert" : "nicht konfiguriert"}</dd></div>
            <div><dt className="text-slate-500">SMTP</dt><dd>{health.config.smtpConfigured ? "konfiguriert" : "nicht konfiguriert"}</dd></div>
            <div><dt className="text-slate-500">Inngest</dt><dd>{health.config.inngestConfigured ? "aktiv" : "Sync-Fallback"}</dd></div>
            <div><dt className="text-slate-500">Sentry</dt><dd>{health.config.sentryConfigured ? "DSN gesetzt" : "nicht konfiguriert"}</dd></div>
          </dl>
        </Card>
      )}

      <Card title="Cron manuell starten" className="mb-6">
        <p className="text-sm text-slate-600 mb-3">
          Führt Erinnerungen, Mahnungen und Nachbestell-Check für Ihren Mandanten aus (wie der tägliche Vercel-Cron).
        </p>
        <Button variant="outline" onClick={triggerCron}>Jobs jetzt ausführen</Button>
      </Card>

      <Card title="Letzte Job-Läufe">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2 pr-2">Zeit</th>
                <th className="py-2 pr-2">Job</th>
                <th className="py-2 pr-2">Auslöser</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Dauer</th>
                <th className="py-2">Fehler</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-slate-50">
                  <td className="py-2 pr-2 whitespace-nowrap">{formatDateTime(r.startedAt)}</td>
                  <td className="py-2 pr-2">{r.jobName}</td>
                  <td className="py-2 pr-2">{r.trigger}</td>
                  <td className="py-2 pr-2">{statusBadge(r.status)}</td>
                  <td className="py-2 pr-2">{r.durationMs != null ? `${(r.durationMs / 1000).toFixed(1)}s` : "—"}</td>
                  <td className="py-2">{r.errors}{r.errorMessage ? ` · ${r.errorMessage.slice(0, 40)}` : ""}</td>
                </tr>
              ))}
              {!runs.length && !loading && (
                <tr><td colSpan={6} className="py-6 text-center text-slate-500">Noch keine protokollierten Läufe</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function CheckRow({
  icon,
  label,
  check,
}: {
  icon: React.ReactNode;
  label: string;
  check: HealthCheck;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-slate-100 p-3">
      <span className="text-[#0d5c63] mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm">{label}</span>
          {statusBadge(check.status)}
        </div>
        {check.latencyMs != null && (
          <p className="text-xs text-slate-400 mt-0.5">{check.latencyMs} ms</p>
        )}
        {check.message && (
          <p className="text-xs text-slate-500 mt-0.5 truncate">{check.message}</p>
        )}
      </div>
    </div>
  );
}
