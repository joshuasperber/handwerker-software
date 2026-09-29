"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { usePermission } from "@/components/auth/can-access";
import { ComposeMessage } from "@/components/messages/compose-message";
import { MessageList } from "@/components/messages/message-list";
import { InvitationsManager } from "@/components/messages/invitations-manager";
import { MessagesInbox } from "@/components/messages/messages-inbox";
import { NotificationsPanel } from "@/components/notifications/notifications-panel";
import { PageTitleIcon } from "@/components/ui/page-title-icon";
import { Bell, Inbox, MessageSquare, Package, Plus, UserPlus, type LucideIcon } from "lucide-react";

type Tab = "inbox" | "notifications" | "compose" | "material" | "invitations";

export function MessagesCenter() {
  const canInvite = usePermission("invitations.manage");
  const [tab, setTab] = useState<Tab>("inbox");

  const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: "inbox", label: "Posteingang", icon: Inbox },
    { id: "notifications", label: "Hinweise", icon: Bell },
    { id: "compose", label: "Neue Nachricht", icon: Plus },
    { id: "material", label: "Material", icon: Package },
    ...(canInvite ? [{ id: "invitations" as const, label: "Einladungen", icon: UserPlus }] : []),
  ];

  return (
    <div>
      <h1 className="mb-4 flex items-center gap-2 text-2xl font-bold text-slate-900">
        <PageTitleIcon icon={MessageSquare} />
        Nachrichten &amp; Einladungen
      </h1>

      <div className="mb-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition-[background-color,border-color,color,box-shadow,transform] active:scale-[.98] sm:justify-start ${
                tab === t.id
                  ? "border-[#0b6268]/20 bg-[#0b6268] text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-[#0b6268]/25 hover:text-[#0b6268]"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{t.label}</span>
            </button>
          );
        })}
      </div>

      {tab === "inbox" && (
        <MessageList box="inbox" emptyLabel="Keine eingegangenen Nachrichten." />
      )}

      {tab === "notifications" && <NotificationsPanel />}

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
