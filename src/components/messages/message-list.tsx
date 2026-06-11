"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { fetchJson } from "@/lib/fetch-json";
import { useSession } from "@/components/auth/can-access";
import { formatDateTime } from "@/lib/utils";
import { MessageSquare, Share2, Package, CheckCheck, Send, Mail } from "lucide-react";

interface Message {
  id: string;
  subject: string | null;
  body: string;
  category: string;
  status: string;
  senderId: string | null;
  recipientUserId: string | null;
  readAt: string | null;
  createdAt: string;
  sender: { firstName: string; lastName: string } | null;
  recipientUser: { firstName: string; lastName: string } | null;
  order: { id?: string; orderNumber: string } | null;
}

function StatusBadge({ message, mineId }: { message: Message; mineId: string }) {
  const outgoing = message.senderId === mineId;

  if (message.category === "MATERIAL_REQUEST") {
    return message.status === "RESOLVED" ? (
      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Erledigt</span>
    ) : (
      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Offen</span>
    );
  }

  if (outgoing) {
    return message.readAt ? (
      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
        <CheckCheck className="h-3 w-3" /> Gelesen
      </span>
    ) : (
      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
        <Send className="h-3 w-3" /> Gesendet
      </span>
    );
  }

  // Eingehend
  return message.readAt ? (
    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Gelesen</span>
  ) : (
    <span className="text-xs bg-[#0d5c63]/10 text-[#0d5c63] px-2 py-0.5 rounded-full inline-flex items-center gap-1">
      <Mail className="h-3 w-3" /> Neu
    </span>
  );
}

export function MessageList({
  box,
  refreshKey = 0,
  emptyLabel = "Keine Nachrichten.",
}: {
  box?: "inbox" | "sent";
  refreshKey?: number;
  emptyLabel?: string;
}) {
  const session = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const q = box ? `?box=${box}` : "";
    fetchJson<Message[]>(`/api/messages${q}`).then((d) => {
      if (d.success && d.data) setMessages(d.data);
      setLoading(false);
    });
  }, [box]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (loading) {
    return <Card><p className="text-center text-slate-500 py-8">Wird geladen...</p></Card>;
  }

  return (
    <Card>
      <div className="divide-y divide-slate-50">
        {messages.map((m) => {
          const outgoing = m.senderId === session.id;
          const counterpart = outgoing
            ? m.recipientUser ? `An ${m.recipientUser.firstName} ${m.recipientUser.lastName}` : "Gesendet"
            : m.sender ? `Von ${m.sender.firstName} ${m.sender.lastName}` : "System";
          const Icon = m.category === "SHARE" ? Share2 : m.category === "MATERIAL_REQUEST" ? Package : MessageSquare;
          return (
            <div key={m.id} className="py-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 flex flex-wrap items-center gap-2">
                    <Icon className="h-4 w-4 text-slate-400 shrink-0" />
                    {m.subject ?? "Nachricht"}
                  </p>
                  <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{m.body}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {counterpart}
                    {m.order && <> · {m.order.orderNumber}</>}
                    {" · "}{formatDateTime(m.createdAt)}
                  </p>
                </div>
                <div className="shrink-0">
                  <StatusBadge message={m} mineId={session.id} />
                </div>
              </div>
            </div>
          );
        })}
        {!messages.length && (
          <p className="text-center text-slate-500 py-8">{emptyLabel}</p>
        )}
      </div>
    </Card>
  );
}
