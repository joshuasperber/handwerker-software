"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchJson } from "@/lib/fetch-json";
import { ROLE_LABELS, formatDateTime } from "@/lib/utils";
import { Mail, Send, RotateCw, Ban, Copy, Check } from "lucide-react";

interface Invitation {
  id: string;
  email: string;
  role: string;
  token: string;
  status: string;
  message: string | null;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  invitedBy: { firstName: string; lastName: string } | null;
  acceptedUser: { firstName: string; lastName: string; email: string } | null;
}

const INVITE_ROLES = ["GAST", "MONTEUR", "BUERO", "MEISTER"];

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  ACCEPTED: "bg-green-100 text-green-800",
  EXPIRED: "bg-slate-100 text-slate-500",
  REVOKED: "bg-red-100 text-red-700",
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Offen",
  ACCEPTED: "Angenommen",
  EXPIRED: "Abgelaufen",
  REVOKED: "Zurückgezogen",
};

export function InvitationsManager() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [form, setForm] = useState({ email: "", role: "GAST", message: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchJson<Invitation[]>("/api/invitations").then((d) => {
      if (d.success && d.data) setInvitations(d.data);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    if (!form.email.trim()) {
      setError("Bitte eine E-Mail-Adresse angeben.");
      return;
    }
    setSending(true);
    const res = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSending(false);
    if (data.success) {
      setForm({ email: "", role: "GAST", message: "" });
      setMsg("Einladung gesendet.");
      load();
    } else {
      setError(data.error ?? "Einladung fehlgeschlagen");
    }
  }

  async function act(id: string, action: "revoke" | "resend") {
    await fetch(`/api/invitations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    load();
  }

  async function copyLink(inv: Invitation) {
    const url = `${window.location.origin}/einladung/${inv.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(inv.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt("Einladungslink kopieren:", url);
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Person einladen">
        <p className="text-sm text-slate-600 mb-3">
          Laden Sie eine Person per E-Mail ein. Gäste sehen nur, was ausdrücklich mit ihnen geteilt wird.
        </p>
        <form onSubmit={invite} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="E-Mail *"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <div>
              <label className="text-sm font-medium">Rolle</label>
              <select
                className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {INVITE_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                ))}
              </select>
            </div>
          </div>
          <Textarea
            label="Persönliche Nachricht (optional)"
            rows={2}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          {msg && <p className="text-sm text-green-700">{msg}</p>}
          <Button type="submit" variant="action" disabled={sending}>
            <Send className="h-4 w-4 mr-1" /> {sending ? "Senden..." : "Einladung senden"}
          </Button>
        </form>
      </Card>

      <Card title="Einladungen">
        <div className="divide-y divide-slate-50">
          {invitations.map((inv) => (
            <div key={inv.id} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 flex flex-wrap items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                    {inv.email}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[inv.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {STATUS_LABEL[inv.status] ?? inv.status}
                    </span>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      {ROLE_LABELS[inv.role] ?? inv.role}
                    </span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Eingeladen{inv.invitedBy ? ` von ${inv.invitedBy.firstName} ${inv.invitedBy.lastName}` : ""} · {formatDateTime(inv.createdAt)}
                    {inv.status === "PENDING" && <> · gültig bis {formatDateTime(inv.expiresAt)}</>}
                    {inv.status === "ACCEPTED" && inv.acceptedAt && <> · angenommen {formatDateTime(inv.acceptedAt)}</>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {inv.status === "PENDING" && (
                    <Button size="sm" variant="outline" onClick={() => copyLink(inv)}>
                      {copiedId === inv.id ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                      {copiedId === inv.id ? "Kopiert" : "Link"}
                    </Button>
                  )}
                  {(inv.status === "EXPIRED" || inv.status === "REVOKED") && (
                    <Button size="sm" variant="outline" onClick={() => act(inv.id, "resend")}>
                      <RotateCw className="h-3.5 w-3.5 mr-1" /> Erneut senden
                    </Button>
                  )}
                  {inv.status === "PENDING" && (
                    <Button size="sm" variant="outline" onClick={() => act(inv.id, "revoke")}>
                      <Ban className="h-3.5 w-3.5 mr-1" /> Zurückziehen
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {!invitations.length && (
            <p className="text-center text-slate-500 py-8">Noch keine Einladungen.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
