"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CanAccess, usePermission } from "@/components/auth/can-access";
import { formatDateTime } from "@/lib/utils";
import { fetchJson } from "@/lib/fetch-json";
import { Package, MessageSquare, CheckCircle } from "lucide-react";

interface Message {
  id: string;
  subject: string | null;
  body: string;
  category: string;
  status: string;
  isInternal: boolean;
  createdAt: string;
  sender: { firstName: string; lastName: string } | null;
  order: { id?: string; orderNumber: string } | null;
}

interface OrderOption {
  id: string;
  orderNumber: string;
  label: string;
}

export function MessagesInbox({ compact = false }: { compact?: boolean }) {
  const canResolve = usePermission("orders.write");
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<"all" | "MATERIAL_REQUEST" | "GENERAL">("all");
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [form, setForm] = useState({ orderId: "", body: "" });
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");
  const [loadError, setLoadError] = useState("");

  function load() {
    const params = filter === "all" ? "" : `?category=${filter}`;
    fetchJson<Message[]>(`/api/messages${params}`).then((d) => {
      if (d.success && d.data) {
        setMessages(d.data);
        setLoadError("");
      } else {
        setLoadError(d.error ?? "Nachrichten konnten nicht geladen werden");
      }
    });
  }

  useEffect(() => { load(); }, [filter]);

  useEffect(() => {
    fetchJson<{ id: string; orderNumber: string; customer: { lastName: string } }[]>("/api/orders")
      .then((d) => {
        if (d.success && d.data) {
          setOrders(
            d.data.slice(0, 30).map((o) => ({
              id: o.id,
              orderNumber: o.orderNumber,
              label: `${o.orderNumber} · ${o.customer?.lastName ?? ""}`,
            }))
          );
        }
      });
  }, []);

  async function submitMaterialRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!form.body.trim()) return;
    setSending(true);
    setMsg("");
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "MATERIAL_REQUEST",
        subject: "Material fehlt – Bestellung anfordern",
        body: form.body.trim(),
        orderId: form.orderId || undefined,
        recipient: "BUERO",
        isInternal: true,
      }),
    });
    const data = await res.json();
    setSending(false);
    if (data.success) {
      setForm({ orderId: "", body: "" });
      setMsg("Anfrage gesendet – Büro/Chef kann bestellen.");
      setFilter("MATERIAL_REQUEST");
      load();
    } else {
      setMsg(data.error ?? "Senden fehlgeschlagen");
    }
  }

  async function resolveRequest(id: string) {
    await fetch(`/api/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "RESOLVED" }),
    });
    load();
  }

  const tabs = [
    { id: "all" as const, label: "Alle" },
    { id: "MATERIAL_REQUEST" as const, label: "Material" },
    { id: "GENERAL" as const, label: "Sonstiges" },
  ];

  return (
    <div className={compact ? "space-y-4" : ""}>
      {!compact && <h1 className="text-2xl font-bold text-slate-900 mb-6">Nachrichten</h1>}

      <Card title="Material melden" className="mb-6">
        <p className="text-sm text-slate-600 mb-3">
          Fehlende Teile oder Material melden – geht als Bestellanfrage an Büro/Chef (erscheint unter Material).
        </p>
        <form onSubmit={submitMaterialRequest} className="space-y-3">
          <div>
            <label className="text-sm font-medium">Auftrag (optional)</label>
            <select
              className="w-full mt-1 h-10 rounded-lg border border-slate-300 px-3 text-sm"
              value={form.orderId}
              onChange={(e) => setForm({ ...form, orderId: e.target.value })}
            >
              <option value="">— Kein Auftrag —</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
          <Textarea
            label="Was fehlt?"
            placeholder="z. B. 20 Fliesen 30x30, 2x Türbeschlag XYZ, 1 Rolle Silikon..."
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={3}
            required
          />
          <Button type="submit" variant="action" disabled={sending}>
            <Package className="h-4 w-4 mr-1" />
            {sending ? "Senden..." : "Bestellung anfordern"}
          </Button>
          {msg && <p className="text-sm text-green-700">{msg}</p>}
        </form>
      </Card>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilter(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === t.id ? "bg-slate-200 text-slate-900" : "bg-white border border-slate-200 text-slate-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loadError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{loadError}</p>
      )}

      <Card>
        <div className="divide-y divide-slate-50">
          {messages.map((m) => (
            <div key={m.id} className="py-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900 flex flex-wrap items-center gap-2">
                    {m.category === "MATERIAL_REQUEST" ? (
                      <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Package className="h-3 w-3" /> Material
                      </span>
                    ) : (
                      <MessageSquare className="h-4 w-4 text-slate-400" />
                    )}
                    {m.subject ?? "Nachricht"}
                    {m.status === "OPEN" && m.category === "MATERIAL_REQUEST" && (
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Offen</span>
                    )}
                    {m.status === "RESOLVED" && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Erledigt</span>
                    )}
                  </p>
                  <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{m.body}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {m.sender ? `${m.sender.firstName} ${m.sender.lastName}` : "System"}
                    {m.order && (
                      <>
                        {" · "}
                        <Link href={`/dashboard/auftraege/${m.order.id ?? ""}`} className="text-[#0d5c63] hover:underline">
                          {m.order.orderNumber}
                        </Link>
                      </>
                    )}
                    {" · "}{formatDateTime(m.createdAt)}
                  </p>
                </div>
                <CanAccess permission="orders.write">
                  {m.category === "MATERIAL_REQUEST" && m.status === "OPEN" && (
                    <Button size="sm" variant="outline" onClick={() => resolveRequest(m.id)}>
                      <CheckCircle className="h-3.5 w-3.5 mr-1" /> Erledigt
                    </Button>
                  )}
                </CanAccess>
              </div>
              {canResolve && m.category === "MATERIAL_REQUEST" && m.status === "OPEN" && (
                <Link href="/dashboard/einkauf" className="text-xs text-[#0d5c63] hover:underline mt-2 inline-block">
                  → Zum Einkauf / Bestellung
                </Link>
              )}
            </div>
          ))}
          {!messages.length && (
            <p className="text-center text-slate-500 py-8">Keine Nachrichten.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
