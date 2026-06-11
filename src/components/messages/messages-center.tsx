"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { usePermission } from "@/components/auth/can-access";
import { ComposeMessage } from "@/components/messages/compose-message";
import { MessageList } from "@/components/messages/message-list";
import { InvitationsManager } from "@/components/messages/invitations-manager";
import { MessagesInbox } from "@/components/messages/messages-inbox";

type Tab = "inbox" | "compose" | "material" | "invitations";

export function MessagesCenter() {
  const canInvite = usePermission("invitations.manage");
  const [tab, setTab] = useState<Tab>("inbox");

  const tabs: { id: Tab; label: string }[] = [
    { id: "inbox", label: "Posteingang" },
    { id: "compose", label: "Neue Nachricht" },
    { id: "material", label: "Material" },
    ...(canInvite ? [{ id: "invitations" as const, label: "Einladungen" }] : []),
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-4">Nachrichten &amp; Einladungen</h1>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.id ? "bg-slate-200 text-slate-900" : "bg-white border border-slate-200 text-slate-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "inbox" && (
        <MessageList box="inbox" emptyLabel="Keine eingegangenen Nachrichten." />
      )}

      {tab === "compose" && (
        <Card title="Neue Nachricht">
          <ComposeMessage showOrderLink onSent={() => setTab("inbox")} />
        </Card>
      )}

      {tab === "material" && <MessagesInbox compact />}

      {tab === "invitations" && canInvite && <InvitationsManager />}
    </div>
  );
}
