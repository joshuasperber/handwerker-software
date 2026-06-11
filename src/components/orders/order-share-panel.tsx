"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchJson } from "@/lib/fetch-json";
import { ROLE_LABELS, formatDate } from "@/lib/utils";
import { Share2, Trash2, UserPlus } from "lucide-react";

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface ShareItem {
  id: string;
  note: string | null;
  createdAt: string;
  sharedWith: { id: string; firstName: string; lastName: string; email: string; role: string };
  sharedBy: { firstName: string; lastName: string } | null;
}

/** Teilt eine Anfrage/einen Auftrag mit eingeladenen Personen (Gästen) oder Mitarbeitern. */
export function OrderSharePanel({ orderId }: { orderId: string }) {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [shares, setShares] = useState<ShareItem[]>([]);
  const [form, setForm] = useState({ userId: "", note: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadShares = useCallback(() => {
    fetchJson<ShareItem[]>(`/api/orders/${orderId}/shares`).then((d) => {
      if (d.success && d.data) setShares(d.data);
    });
  }, [orderId]);

  useEffect(() => {
    loadShares();
    fetchJson<UserOption[]>("/api/users?role=GAST,MONTEUR,BUERO,MEISTER").then((d) => {
      if (d.success && d.data) setUsers(d.data);
    });
  }, [loadShares]);

  const sharedIds = new Set(shares.map((s) => s.sharedWith.id));
  const availableUsers = users.filter((u) => !sharedIds.has(u.id));

  async function share(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.userId) {
      setError("Bitte eine Person auswählen.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/orders/${orderId}/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: form.userId, note: form.note.trim() || undefined }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.success) {
      setForm({ userId: "", note: "" });
      loadShares();
    } else {
      setError(data.error ?? "Teilen fehlgeschlagen");
    }
  }

  async function removeShare(shareId: string) {
    await fetch(`/api/orders/${orderId}/shares/${shareId}`, { method: "DELETE" });
    loadShares();
  }

  return (
    <Card title="Teilen">
      <p className="text-xs text-slate-500 mb-3">
        Teilen Sie diese Anfrage mit einer eingeladenen Person. Sie erhält Lesezugriff und eine Benachrichtigung.
      </p>

      <form onSubmit={share} className="space-y-3">
        <div>
          <label className="text-xs text-slate-500">Person</label>
          <select
            className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
            value={form.userId}
            onChange={(e) => setForm({ ...form, userId: e.target.value })}
          >
            <option value="">— Person wählen —</option>
            {availableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName} · {ROLE_LABELS[u.role] ?? u.role}
              </option>
            ))}
          </select>
          {availableUsers.length === 0 && (
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <UserPlus className="h-3 w-3" />
              Niemand verfügbar.{" "}
              <Link href="/dashboard/nachrichten" className="text-[#0d5c63] hover:underline">Person einladen</Link>
            </p>
          )}
        </div>
        <Input
          label="Notiz (optional)"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button size="sm" type="submit" variant="action" disabled={busy || !form.userId}>
          <Share2 className="h-4 w-4 mr-1" /> Teilen
        </Button>
      </form>

      {shares.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
          {shares.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{s.sharedWith.firstName} {s.sharedWith.lastName}</p>
                <p className="text-xs text-slate-400 truncate">
                  {s.sharedWith.email} · {ROLE_LABELS[s.sharedWith.role] ?? s.sharedWith.role} · {formatDate(s.createdAt)}
                </p>
                {s.note && <p className="text-xs text-slate-500 mt-0.5">{s.note}</p>}
              </div>
              <button
                type="button"
                onClick={() => removeShare(s.id)}
                className="text-slate-400 hover:text-red-600 shrink-0"
                aria-label="Freigabe entfernen"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
