"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Download,
  Loader2,
  AlertTriangle,
  Database,
  HardDrive,
  Bot,
  Users,
  FileText,
  Scale,
  KeyRound,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { fetchJson } from "@/lib/fetch-json";
import { SettingsPageHeader } from "@/components/dashboard/settings-page-header";
import { saveJson } from "@/lib/save-toast";

type SecurityOverview = {
  generatedAt: string;
  users: Array<{
    id: string;
    email: string;
    role: string;
    isActive: boolean;
    lastLoginAt: string | null;
  }>;
  login: {
    failedLast24h: number;
    failedLast7d: number;
    recentFailed: Array<{ email: string; ip: string | null; createdAt: string }>;
  };
  audit: Array<{
    id: string;
    entityType: string;
    entityId: string;
    action: string;
    createdAt: string;
    user: string | null;
  }>;
  ai: {
    sessionCount: number;
    messagesLast7d: number;
    llmConfigured: boolean;
    providerHint: string;
    retentionNote: string;
  };
  storage: {
    configured: boolean;
    signedUrlsPreferred: boolean;
    publicUrlConfigured: boolean;
    maxUploadMb: number;
    allowedTypes: string[];
    malwareScan: string;
  };
  backups: { status: string; recommendation: string };
  privacyEndpoints: { export: string; erasureCheck: string };
};

export default function SicherheitPage() {
  const [data, setData] = useState<SecurityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [legalForm, setLegalForm] = useState({
    privacyPolicyUrl: "",
    imprintUrl: "",
  });
  const [legalSaving, setLegalSaving] = useState(false);
  const [legalLoaded, setLegalLoaded] = useState(false);
  const [erasure, setErasure] = useState<{
    blockers: string[];
    canHardDelete: boolean;
    recommendedSteps: string[];
    counts: Record<string, number>;
  } | null>(null);
  const [erasureLoading, setErasureLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetchJson<SecurityOverview>("/api/admin/security");
    if (res.success && res.data) {
      setData(res.data);
    } else {
      setError(res.error ?? "Sicherheitsübersicht konnte nicht geladen werden");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    fetchJson<{ privacyPolicyUrl: string | null; imprintUrl: string | null }>("/api/tenant/settings").then(
      (res) => {
        if (res.success && res.data) {
          setLegalForm({
            privacyPolicyUrl: res.data.privacyPolicyUrl ?? "",
            imprintUrl: res.data.imprintUrl ?? "",
          });
          setLegalLoaded(true);
        }
      }
    );
  }, [load]);

  async function saveLegalUrls() {
    setLegalSaving(true);
    await saveJson(
      "/api/tenant/settings",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privacyPolicyUrl: legalForm.privacyPolicyUrl,
          imprintUrl: legalForm.imprintUrl,
        }),
      },
      {
        loading: "Rechtliche Links werden gespeichert …",
        success: "Impressum- und Datenschutz-Links gespeichert",
      }
    );
    setLegalSaving(false);
  }

  async function downloadOwnExport() {
    const toastId = toast.loading("Datenexport wird erstellt …");
    const res = await fetch("/api/privacy/export", { credentials: "include" });
    const json = await res.json();
    if (!res.ok || !json.success) {
      toast.error(json.error ?? "Export fehlgeschlagen", { id: toastId });
      return;
    }
    const blob = new Blob([JSON.stringify(json.data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jomaster-privacy-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export heruntergeladen", { id: toastId });
  }

  async function runErasureCheck() {
    if (!customerId.trim()) {
      toast.error("Bitte eine Kunden-ID eingeben");
      return;
    }
    setErasureLoading(true);
    setErasure(null);
    const res = await fetchJson<{
      blockers: string[];
      canHardDelete: boolean;
      recommendedSteps: string[];
      counts: Record<string, number>;
    }>(`/api/privacy/erasure-check?customerId=${encodeURIComponent(customerId.trim())}`);
    setErasureLoading(false);
    if (!res.success || !res.data) {
      toast.error(res.error ?? "Prüfung fehlgeschlagen");
      return;
    }
    setErasure(res.data);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SettingsPageHeader href="/dashboard/einstellungen/sicherheit" className="mb-0" />
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} className="shrink-0 gap-2">
          <Loader2 className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Aktualisieren
        </Button>
      </div>

      <p className="text-xs text-slate-500">
        Technische Übersicht — ersetzt keine Rechts- oder Datenschutzberatung.
      </p>

      <Card className="!p-4 space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Scale className="h-4 w-4" /> Rechtliche Pflichtangaben
        </h2>
        <p className="text-sm text-slate-600">
          Die JoMaster-Seiten sind Platzhalter und müssen vor dem Produktivbetrieb rechtlich geprüft
          werden. Betriebsspezifische Links gelten zusätzlich für Ihre Buchungsseite.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/impressum">
              <FileText className="mr-1.5 h-4 w-4" /> Impressum
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/datenschutz">
              <FileText className="mr-1.5 h-4 w-4" /> Datenschutzerklärung
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/agb">
              <FileText className="mr-1.5 h-4 w-4" /> AGB
            </Link>
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Impressum-URL (Betrieb)"
            value={legalForm.imprintUrl}
            onChange={(e) => setLegalForm((f) => ({ ...f, imprintUrl: e.target.value }))}
            placeholder="https://…/impressum"
            disabled={!legalLoaded}
          />
          <Input
            label="Datenschutz-URL (Betrieb)"
            value={legalForm.privacyPolicyUrl}
            onChange={(e) => setLegalForm((f) => ({ ...f, privacyPolicyUrl: e.target.value }))}
            placeholder="https://…/datenschutz"
            disabled={!legalLoaded}
          />
        </div>
        <Button type="button" variant="action" size="sm" disabled={legalSaving || !legalLoaded} onClick={() => void saveLegalUrls()}>
          {legalSaving ? "Speichern…" : "Links speichern"}
        </Button>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="!p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4" /> Zugriffsrechte
          </h2>
          <p className="mb-3 text-sm text-slate-600">
            Wer welche Bereiche sehen und bearbeiten darf, steuern Sie über Rollen.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/einstellungen/rollen">Rollen & Rechte öffnen</Link>
          </Button>
        </Card>
        <Card className="!p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Bot className="h-4 w-4" /> KI-Datenschutz
          </h2>
          <p className="mb-3 text-sm text-slate-600">
            Der Assistent sieht nur Daten, die Ihre Rolle bereits sehen darf. Weitere Hinweise stehen
            weiter unten und in den Assistenten-Einstellungen.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/einstellungen/assistent">Assistenten-Einstellungen</Link>
          </Button>
        </Card>
      </div>

      {error && (
        <Card className="border-rose-200 bg-rose-50 !p-4 text-rose-800">{error}</Card>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Laden…
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="!p-4">
              <p className="text-xs text-slate-500">Fehl-Logins 24h</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{data.login.failedLast24h}</p>
            </Card>
            <Card className="!p-4">
              <p className="text-xs text-slate-500">Fehl-Logins 7 Tage</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{data.login.failedLast7d}</p>
            </Card>
            <Card className="!p-4">
              <p className="text-xs text-slate-500">KI-Sessions</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{data.ai.sessionCount}</p>
            </Card>
            <Card className="!p-4">
              <p className="text-xs text-slate-500">Aktive Nutzer</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {data.users.filter((u) => u.isActive).length}/{data.users.length}
              </p>
            </Card>
          </div>

          <Card className="!p-4 space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Download className="h-4 w-4" /> Export und Löschung personenbezogener Daten
            </h2>
            <p className="text-sm text-slate-600">
              Lädt einen technischen JSON-Export der eigenen Nutzerdaten (Art. 15 Vorbereitung).
            </p>
            <Button type="button" onClick={() => void downloadOwnExport()}>
              Eigenen Datenexport herunterladen
            </Button>
          </Card>

          <Card className="!p-4 space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <AlertTriangle className="h-4 w-4" /> Lösch-Check (Kunde)
            </h2>
            <p className="text-sm text-slate-600">
              Prüft Blocker vor einer möglichen Löschung/Anonymisierung (Art. 17 Vorbereitung).
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Kunden-ID"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                disabled={erasureLoading}
                onClick={() => void runErasureCheck()}
              >
                {erasureLoading ? "Prüfe…" : "Löschbarkeit prüfen"}
              </Button>
            </div>
            {erasure && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm space-y-2">
                <p>
                  Hard-Delete möglich:{" "}
                  <strong>{erasure.canHardDelete ? "ja" : "nein / eingeschränkt"}</strong>
                </p>
                <p className="text-xs text-slate-500">
                  Aufträge {erasure.counts.orders ?? 0} · Dokumente {erasure.counts.documents ?? 0} ·
                  Dateien {erasure.counts.files ?? 0}
                </p>
                {erasure.blockers.length > 0 && (
                  <ul className="list-disc pl-5 text-amber-800">
                    {erasure.blockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
                <ul className="list-disc pl-5 text-slate-600">
                  {erasure.recommendedSteps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="!p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4" /> Nutzer & Rollen
              </h2>
              <div className="max-h-72 space-y-2 overflow-y-auto text-sm">
                {data.users.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-2 border-b border-slate-50 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{u.email}</p>
                      <p className="text-xs text-slate-500">
                        {u.role}
                        {u.lastLoginAt ? ` · zuletzt ${formatDateTime(u.lastLoginAt)}` : ""}
                      </p>
                    </div>
                    <Badge
                      status={u.isActive ? "VERFUEGBAR" : "KRANK"}
                      label={u.isActive ? "Aktiv" : "Inaktiv"}
                    />
                  </div>
                ))}
              </div>
            </Card>

            <Card className="!p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Database className="h-4 w-4" /> Fehlgeschlagene Logins (7 Tage)
              </h2>
              {data.login.recentFailed.length === 0 ? (
                <p className="text-sm text-slate-500">Keine fehlgeschlagenen Versuche.</p>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto text-sm">
                  {data.login.recentFailed.map((a, i) => (
                    <div key={`${a.email}-${a.createdAt}-${i}`} className="border-b border-slate-50 py-2">
                      <p className="font-medium">{a.email}</p>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(a.createdAt)}
                        {a.ip ? ` · IP ${a.ip}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card className="!p-4">
            <h2 className="mb-3 text-sm font-semibold">Letzte Audit-Aktivitäten</h2>
            {data.audit.length === 0 ? (
              <p className="text-sm text-slate-500">Keine Einträge in den letzten 7 Tagen.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b">
                      <th className="py-2 pr-3">Zeit</th>
                      <th className="py-2 pr-3">Nutzer</th>
                      <th className="py-2 pr-3">Aktion</th>
                      <th className="py-2">Objekt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.audit.map((l) => (
                      <tr key={l.id} className="border-b border-slate-50">
                        <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                        <td className="py-2 pr-3">{l.user ?? "—"}</td>
                        <td className="py-2 pr-3">{l.action}</td>
                        <td className="py-2">
                          {l.entityType} · {l.entityId.slice(0, 10)}…
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="!p-4 space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Bot className="h-4 w-4" /> KI-Datenschutz
              </h2>
              <p className="text-sm text-slate-600">
                LLM konfiguriert: <strong>{data.ai.llmConfigured ? "ja" : "nein"}</strong>
                {data.ai.providerHint !== "none" ? ` (${data.ai.providerHint})` : ""}
              </p>
              <p className="text-xs text-slate-500">{data.ai.retentionNote}</p>
              <p className="text-xs text-slate-500">
                Nachrichten (7 Tage): {data.ai.messagesLast7d}
              </p>
            </Card>
            <Card className="!p-4 space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <HardDrive className="h-4 w-4" /> Datei-Upload-Sicherheit
              </h2>
              <p className="text-sm text-slate-600">
                Storage: {data.storage.configured ? "konfiguriert" : "nicht konfiguriert"}
              </p>
              <p className="text-xs text-slate-500">
                Max. {data.storage.maxUploadMb} MB · {data.storage.allowedTypes.join(", ")}
              </p>
              <p className="text-xs text-amber-700">
                Malware-Scan: {data.storage.malwareScan}
                {data.storage.publicUrlConfigured
                  ? " · S3_PUBLIC_URL gesetzt (für PII prüfen)"
                  : " · bevorzugt signierte URLs"}
              </p>
            </Card>
            <Card className="!p-4 space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Database className="h-4 w-4" /> Backups
              </h2>
              <p className="text-sm text-slate-600">Status: {data.backups.status}</p>
              <p className="text-xs text-slate-500">{data.backups.recommendation}</p>
            </Card>
          </div>

          <Card className="border-dashed !p-4 text-xs text-slate-500">
            Stand {formatDateTime(data.generatedAt)}. Endpunkte: {data.privacyEndpoints.export} ·{" "}
            {data.privacyEndpoints.erasureCheck}&lt;id&gt;
          </Card>
        </>
      )}
    </div>
  );
}
