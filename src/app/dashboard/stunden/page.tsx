"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CanAccess } from "@/components/auth/can-access";
import { swrKeys, useApiSWR } from "@/lib/swr";
import {
  TIME_ENTRY_STATUS_LABELS,
  calcWorkedHours,
} from "@/lib/time-entry";
import { formatDateTime } from "@/lib/utils";
import { startOfWeek, endOfWeek, format, addWeeks, subWeeks } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { toast } from "sonner";
import { mutate as globalMutate } from "swr";

type TotalsRow = {
  employeeId: string;
  name: string;
  hours: number;
  entryCount: number;
  openCount: number;
};

type EntryRow = {
  id: string;
  startTime: string;
  endTime: string | null;
  breakMinutes: number;
  activity: string | null;
  notes: string | null;
  status: string;
  employee: { id: string; user: { firstName: string; lastName: string } };
  order: {
    orderNumber: string;
    customer: { firstName: string; lastName: string };
  } | null;
};

type TeamHoursData = {
  totalsByEmployee: TotalsRow[];
  entries: EntryRow[];
  totalHours: number;
  employees: { id: string; name: string }[];
};

export default function TeamStundenPage() {
  const [weekStart, setWeekStart] = useState(
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd")
  );
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState("");

  const from = weekStart;
  const to = format(endOfWeek(new Date(weekStart), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const qs = new URLSearchParams({ from, to });
  if (employeeId) qs.set("employeeId", employeeId);
  if (status) qs.set("status", status);

  const key = swrKeys.timeEntries(qs.toString());
  const { data, error, isLoading, mutate } = useApiSWR<TeamHoursData>(key);

  const weekLabel = useMemo(() => {
    const start = new Date(weekStart);
    const end = endOfWeek(start, { weekStartsOn: 1 });
    return `${format(start, "d. MMM", { locale: de })} – ${format(end, "d. MMM yyyy", { locale: de })}`;
  }, [weekStart]);

  async function setEntryStatus(id: string, next: string) {
    const res = await fetch(`/api/time-entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success("Status aktualisiert");
      await mutate();
      void globalMutate((k) => typeof k === "string" && k.startsWith("/api/time-entries"));
    } else {
      toast.error(json.error ?? "Fehler");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Team-Stunden</h1>
        <p className="text-sm text-muted-foreground">
          Wochenauswertung aller Mitarbeiter — prüfen und freigeben
        </p>
      </div>

      <Card className="!p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() =>
                setWeekStart(
                  format(
                    subWeeks(new Date(weekStart), 1),
                    "yyyy-MM-dd"
                  )
                )
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[10rem] text-center">
              <p className="text-sm font-semibold text-slate-900">{weekLabel}</p>
              <p className="text-xs text-slate-500">KW-Ansicht</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() =>
                setWeekStart(
                  format(
                    addWeeks(new Date(weekStart), 1),
                    "yyyy-MM-dd"
                  )
                )
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              className="h-9 rounded-lg border border-slate-300 px-2 text-sm"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">Alle Mitarbeiter</option>
              {(data?.employees ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-lg border border-slate-300 px-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Alle Status</option>
              <option value="OPEN">Offen</option>
              <option value="REVIEWED">Geprüft</option>
              <option value="APPROVED">Freigegeben</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-xl bg-[#0d5c63]/5 px-4 py-3">
          <Clock className="h-5 w-5 text-[#0d5c63]" />
          <div>
            <p className="text-xs text-slate-500">Summe Team</p>
            <p className="text-xl font-bold text-[#0d5c63]">
              {(data?.totalHours ?? 0).toFixed(2)} h
            </p>
          </div>
        </div>
      </Card>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error.message}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data?.totalsByEmployee ?? []).map((row) => (
          <Card key={row.employeeId} className="!p-4">
            <p className="font-semibold text-slate-900">{row.name}</p>
            <p className="mt-1 text-2xl font-bold text-[#0d5c63]">
              {row.hours.toFixed(2)} h
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {row.entryCount} Einträge
              {row.openCount > 0 ? ` · ${row.openCount} offen` : ""}
            </p>
          </Card>
        ))}
        {!isLoading && (data?.totalsByEmployee?.length ?? 0) === 0 && (
          <p className="text-sm text-slate-500 col-span-full">
            Keine Mitarbeiter oder keine Zeiten in dieser Woche.
          </p>
        )}
      </div>

      <Card title="Einträge">
        {isLoading ? (
          <p className="py-6 text-center text-sm text-slate-500">Laden…</p>
        ) : (data?.entries?.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Keine Zeiteinträge in diesem Zeitraum.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {data!.entries.map((e) => {
              const hours = calcWorkedHours(e.startTime, e.endTime, e.breakMinutes);
              const name = `${e.employee.user.firstName} ${e.employee.user.lastName}`.trim();
              const label = e.order
                ? `${e.order.orderNumber} · ${e.order.customer.lastName}`
                : e.activity || "Ohne Auftrag";
              return (
                <div
                  key={e.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{name}</p>
                    <p className="text-sm text-slate-600">{label}</p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(e.startTime)}
                      {e.endTime ? ` – ${formatDateTime(e.endTime)}` : " (offen)"}
                      {hours != null ? ` · ${hours.toFixed(2)} h` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {TIME_ENTRY_STATUS_LABELS[e.status] ?? e.status}
                    </Badge>
                    <CanAccess permission="time_entries.approve">
                      {e.status === "OPEN" && (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => setEntryStatus(e.id, "REVIEWED")}
                        >
                          Prüfen
                        </Button>
                      )}
                      {e.status !== "APPROVED" && (
                        <Button
                          size="xs"
                          variant="primary"
                          onClick={() => setEntryStatus(e.id, "APPROVED")}
                        >
                          Freigeben
                        </Button>
                      )}
                      {e.status === "APPROVED" && (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setEntryStatus(e.id, "OPEN")}
                        >
                          Zurücksetzen
                        </Button>
                      )}
                    </CanAccess>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
