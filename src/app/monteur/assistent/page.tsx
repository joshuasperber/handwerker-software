"use client";

import { AssistantChat } from "@/components/ai/assistant-chat";
import { CanAccess } from "@/components/auth/can-access";

export default function MonteurAssistentPage() {
  return (
    <CanAccess
      permission="ai.chat"
      fallback={
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Der Betriebsassistent ist für Ihre Rolle nicht freigeschaltet.
        </div>
      }
    >
      {/* Volle Breite unter Bottom-Nav — ohne doppelte Titel */}
      <div className="-mx-4 -mt-2 -mb-24 sm:mx-0 sm:mt-0 sm:mb-0">
        <AssistantChat variant="work" />
      </div>
    </CanAccess>
  );
}
