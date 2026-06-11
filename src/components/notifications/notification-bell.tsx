"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    const tick = async () => {
      const res = await fetchJson<{ unreadCount: number }>("/api/notifications/unread-count");
      if (active && res.success && res.data) setUnread(res.data.unreadCount);
    };
    void tick();
    const t = setInterval(() => void tick(), 60000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const load = async () => {
      const res = await fetchJson<{ items: NotificationItem[]; unreadCount: number }>(
        "/api/notifications"
      );
      if (active && res.success && res.data) {
        setItems(res.data.items);
        setUnread(res.data.unreadCount);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [open]);

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
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    setUnread((u) => Math.max(0, u - 1));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Benachrichtigungen"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
          <span className="font-semibold text-slate-800">Benachrichtigungen</span>
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
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-400">
              Keine Benachrichtigungen
            </p>
          ) : (
            items.map((n) => {
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
                  <span className="pl-4 text-xs text-slate-500 line-clamp-2">{n.body}</span>
                  <span className="pl-4 text-[10px] uppercase tracking-wide text-slate-400">
                    {timeAgo(n.createdAt)}
                  </span>
                </div>
              );
              const cls = "block border-b border-slate-50 px-3 py-2.5 text-left hover:bg-slate-50";
              return n.link ? (
                <Link
                  key={n.id}
                  href={n.link}
                  className={cls}
                  onClick={() => {
                    if (!n.readAt) markOneRead(n.id);
                    setOpen(false);
                  }}
                >
                  {inner}
                </Link>
              ) : (
                <button
                  key={n.id}
                  type="button"
                  className={`w-full ${cls}`}
                  onClick={() => !n.readAt && markOneRead(n.id)}
                >
                  {inner}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
