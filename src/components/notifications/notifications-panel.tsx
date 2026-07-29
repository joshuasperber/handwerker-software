"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { fetchJson } from "@/lib/fetch-json";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.floor(h / 24);
  return `vor ${d} Tg.`;
}

/** Volle Liste der Glocken-Benachrichtigungen, z. B. für die Nachrichten-Seite. */
export function NotificationsPanel() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const res = await fetchJson<{ items: NotificationItem[]; unreadCount: number }>(
        "/api/notifications"
      );
      if (active && res.success && res.data) {
        setItems(res.data.items);
        setUnread(res.data.unreadCount);
      }
      if (active) setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  async function markAllRead() {
    await fetchJson("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnread(0);
  }

  async function markOneRead(id: string) {
    await fetchJson("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
    );
    setUnread((u) => Math.max(0, u - 1));
  }

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Bell className="h-4 w-4 text-[#0d5c63]" />
          Benachrichtigungen
          {unread > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold text-white">
              {unread}
            </span>
          )}
        </span>
        {unread > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="flex items-center gap-1 text-xs text-[#0d5c63] hover:underline"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Alle gelesen
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Wird geladen …
        </div>
      ) : items.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-400">
          Keine Benachrichtigungen vorhanden.
        </p>
      ) : (
        <div>
          {items.map((n) => {
            const inner = (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-start gap-2">
                  {!n.readAt && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#0d5c63]" />
                  )}
                  <span
                    className={`text-sm ${n.readAt ? "text-slate-600" : "font-semibold text-slate-900"}`}
                  >
                    {n.title}
                  </span>
                </div>
                <span className="pl-4 text-xs text-slate-500">{n.body}</span>
                <span className="pl-4 text-[10px] uppercase tracking-wide text-slate-400">
                  {timeAgo(n.createdAt)}
                </span>
              </div>
            );
            const cls =
              "block w-full border-b border-slate-50 px-4 py-3 text-left last:border-0 hover:bg-slate-50";
            return n.link ? (
              <Link
                key={n.id}
                href={n.link}
                className={cls}
                onClick={() => {
                  if (!n.readAt) void markOneRead(n.id);
                }}
              >
                {inner}
              </Link>
            ) : (
              <button
                key={n.id}
                type="button"
                className={cls}
                onClick={() => !n.readAt && void markOneRead(n.id)}
              >
                {inner}
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
