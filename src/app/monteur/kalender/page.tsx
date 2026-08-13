"use client";

import Link from "next/link";
import { TeamCalendarView } from "@/components/calendar/team-calendar-view";
import { ArrowLeft } from "lucide-react";

/** Team-Kalender für alle Mitarbeiter in der Arbeitsansicht. */
export default function MonteurKalenderPage() {
  return (
    <div className="space-y-3">
      <Link
        href="/monteur/mitarbeiter"
        className="relative z-20 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-[#0d5c63] shadow-sm active:scale-[0.98]"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" />
        Zurück zum Team
      </Link>
      <TeamCalendarView
        title="Team-Kalender"
        orderLinkBase="/monteur/auftrag"
        compactHeader
      />
    </div>
  );
}
