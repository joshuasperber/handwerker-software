"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { fetchJson } from "@/lib/fetch-json";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { de } from "date-fns/locale";
import { Clock } from "lucide-react";

interface TimeEntry {
  id: string;
  startTime: string;
  endTime: string | null;
  breakMinutes: number;
  notes: string | null;
  order: { id: string; orderNumber: string; customer: { firstName: string; lastName: string } };
}

export function StundenzettelView({ title = "Stundenzettel" }: { title?: string }) {
  const [weekStart, setWeekStart] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const from = weekStart;
    const to = format(endOfWeek(new Date(weekStart), { weekStartsOn: 1 }), "yyyy-MM-dd");
    fetchJson<{ entries: TimeEntry[]; totalHours: number }>(`/api/monteur/timesheet?from=${from}&to=${to}`)
      .then((d) => {
        if (d.success && d.data) {
          setEntries(d.data.entries);
          setTotalHours(d.data.totalHours);
          setError("");
        } else {
          setError(d.error ?? "Zeiten konnten nicht geladen werden");
        }
      });
  }, [weekStart]);

  function entryHours(e: TimeEntry) {
    if (!e.endTime) return "läuft";
    const ms = new Date(e.endTime).getTime() - new Date(e.startTime).getTime();
    const h = Math.max(0, ms / 3600000 - (e.breakMinutes ?? 0) / 60);
    return `${h.toFixed(2)} h`;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Clock className="h-6 w-6 text-[#0d5c63]" /> {title}
        </h1>
        <p className="text-sm text-slate-500 mt-1">Ihre erfassten Arbeitszeiten</p>
        <input
          type="date"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
          className="mt-2 h-10 rounded-lg border border-slate-300 px-3 text-sm"
        />
        <p className="text-xs text-slate-400 mt-1">
          Woche ab {format(new Date(weekStart), "EEEE, d. MMMM", { locale: de })}
        </p>
      </div>

      <Card className="!p-4 bg-[#0d5c63]/5">
        <p className="text-sm text-slate-600">Summe diese Woche</p>
        <p className="text-2xl font-bold text-[#0d5c63]">{totalHours} Stunden</p>
      </Card>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <Card>
        {entries.length === 0 ? (
          <p className="text-center text-slate-500 py-8">Keine Zeiten in dieser Woche.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {entries.map((e) => (
              <div key={e.id} className="py-3">
                <p className="font-medium text-sm">
                  {e.order.orderNumber} · {e.order.customer.lastName}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatDateTime(e.startTime)}
                  {e.endTime ? ` – ${formatDateTime(e.endTime)}` : " (offen)"}
                </p>
                {e.notes && <p className="text-xs text-slate-400 italic">{e.notes}</p>}
                <p className="text-sm font-semibold text-[#0d5c63] mt-1">{entryHours(e)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
