"use client";

import { Bot } from "lucide-react";
import { AssistantChat } from "@/components/ai/assistant-chat";
import { CanAccess } from "@/components/auth/can-access";

export default function MonteurAssistentPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Bot className="h-6 w-6 text-[#0d5c63]" />
          Betriebsassistent
        </h1>
        <p className="text-sm text-slate-500">
          Fragen zu heutigen Terminen, Material und Aufträgen — nur mit Ihren Freigaben.
        </p>
      </div>
      <CanAccess
        permission="ai.chat"
        fallback={
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            Der Betriebsassistent ist für Ihre Rolle nicht freigeschaltet.
          </div>
        }
      >
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden min-h-[60vh]">
          <AssistantChat />
        </div>
      </CanAccess>
    </div>
  );
}
