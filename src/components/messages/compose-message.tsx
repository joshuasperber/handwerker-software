"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchJson } from "@/lib/fetch-json";
import { ROLE_LABELS } from "@/lib/utils";
import { Send } from "lucide-react";

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface OrderOption {
  id: string;
  orderNumber: string;
  customer?: { lastName?: string | null } | null;
}

/**
 * Einfaches Formular zum Verfassen einer Direktnachricht.
 * `recipientRoles` filtert die auswählbaren Empfänger (z. B. nur Mitarbeiter für Gäste).
 */
export function ComposeMessage({
  recipientRoles,
  showOrderLink = false,
  onSent,
}: {
  recipientRoles?: string;
  showOrderLink?: boolean;
  onSent?: () => void;
}) {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [form, setForm] = useState({ recipientUserId: "", subject: "", body: "", orderId: "" });
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const q = recipientRoles ? `?role=${recipientRoles}` : "";
    fetchJson<UserOption[]>(`/api/users${q}`).then((d) => {
      if (d.success && d.data) setUsers(d.data);
    });
  }, [recipientRoles]);

  useEffect(() => {
    if (!showOrderLink) return;
    fetchJson<OrderOption[]>("/api/orders").then((d) => {
      if (d.success && d.data) setOrders(d.data.slice(0, 50));
    });
  }, [showOrderLink]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    if (!form.recipientUserId) {
      setError("Bitte einen Empfänger auswählen.");
      return;
    }
    if (!form.body.trim()) {
      setError("Bitte einen Nachrichtentext eingeben.");
      return;
    }
    setSending(true);
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientUserId: form.recipientUserId,
        subject: form.subject.trim() || undefined,
        body: form.body.trim(),
        orderId: form.orderId || undefined,
        category: "DIRECT",
      }),
    });
    const data = await res.json();
    setSending(false);
    if (data.success) {
      setForm({ recipientUserId: "", subject: "", body: "", orderId: "" });
      setMsg("Nachricht gesendet.");
      onSent?.();
    } else {
      setError(data.error ?? "Senden fehlgeschlagen");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="text-sm font-medium">Empfänger *</label>
        <select
          className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
          value={form.recipientUserId}
          onChange={(e) => setForm({ ...form, recipientUserId: e.target.value })}
        >
          <option value="">— Person auswählen —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.firstName} {u.lastName} · {ROLE_LABELS[u.role] ?? u.role}
            </option>
          ))}
        </select>
        {users.length === 0 && (
          <p className="text-xs text-slate-400 mt-1">Keine Empfänger verfügbar.</p>
        )}
      </div>

      {showOrderLink && (
        <div>
          <label className="text-sm font-medium">Bezug zu Auftrag (optional)</label>
          <select
            className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
            value={form.orderId}
            onChange={(e) => setForm({ ...form, orderId: e.target.value })}
          >
            <option value="">— Kein Auftrag —</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNumber}{o.customer?.lastName ? ` · ${o.customer.lastName}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <Input
        label="Betreff (optional)"
        value={form.subject}
        onChange={(e) => setForm({ ...form, subject: e.target.value })}
      />
      <Textarea
        label="Nachricht *"
        rows={4}
        value={form.body}
        onChange={(e) => setForm({ ...form, body: e.target.value })}
        required
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-green-700">{msg}</p>}

      <Button type="submit" variant="action" disabled={sending}>
        <Send className="h-4 w-4 mr-1" /> {sending ? "Senden..." : "Nachricht senden"}
      </Button>
    </form>
  );
}
