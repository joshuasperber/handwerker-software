"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ComposeMessage } from "@/components/messages/compose-message";
import { MessageList } from "@/components/messages/message-list";
import { MessageSquare } from "lucide-react";

export default function PortalMessagesPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-[#0d5c63]" /> Nachrichten
        </h1>
        <p className="text-sm text-slate-500 mt-1">Schreiben Sie dem Betrieb oder antworten Sie auf Nachrichten.</p>
      </div>

      <Card title="Neue Nachricht">
        <ComposeMessage
          recipientRoles="ADMIN,MEISTER,BUERO,MONTEUR"
          onSent={() => setRefreshKey((k) => k + 1)}
        />
      </Card>

      <MessageList box="inbox" refreshKey={refreshKey} emptyLabel="Noch keine Nachrichten." />
    </div>
  );
}
