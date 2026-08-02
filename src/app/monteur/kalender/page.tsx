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
        className="inline-flex items-center gap-1 text-sm text-[#0d5c63]"
      >
        <ArrowLeft className="h-4 w-4" /> Team
      </Link>
      <TeamCalendarView
        title="Team-Kalender"
        orderLinkBase="/monteur/auftrag"
        compactHeader
      />
    </div>
  );
}
