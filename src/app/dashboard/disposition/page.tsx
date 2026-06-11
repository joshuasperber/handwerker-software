"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InfoButton } from "@/components/ui/info-button";
import { Users, Truck, AlertCircle } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { MATERIAL_STATUS_LABELS } from "@/lib/inventory/formulas";
import { Button } from "@/components/ui/button";

interface EmployeeAvail {
  id: string;
  name: string;
  operationalStatus: string;
  available: boolean;
  onAbsence: boolean;
  absenceType?: string;
  teams: string[];
  appointmentsToday: { orderNumber: string; startTime: string }[];
}

interface Team {
  id: string;
  name: string;
  vehicle: { name: string; licensePlate: string | null } | null;
  members: { employee: { user: { firstName: string; lastName: string } }; isForeman: boolean }[];
  orders: { id: string; orderNumber: string }[];
}

interface TodayOrder {
  id: string;
  orderNumber: string;
  title: string;
  customer: string;
  address: string;
  materialStatus: string;
  materialAmpel: string;
  employees: string[];
  team: string | null;
  vehicle: { name: string; licensePlate: string | null } | null;
}

export default function DispositionPage() {
  const [employees, setEmployees] = useState<EmployeeAvail[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [todayOrders, setTodayOrders] = useState<TodayOrder[]>([]);
  const [critical, setCritical] = useState<{ materialIssues: unknown[]; delayedOrders: unknown[] } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/disposition/availability").then((r) => r.json()),
      fetch("/api/dashboard/today").then((r) => r.json()),
      fetch("/api/dashboard/critical").then((r) => r.json()),
    ]).then(([d, t, c]) => {
      if (d.success) {
        setEmployees(d.data.employees);
        setTeams(d.data.teams);
      }
      if (t.success) setTodayOrders(t.data.orders);
      if (c.success) setCritical(c.data);
    });
  }, []);

  // Vereinfachter, kalenderbasierter Mitarbeiter-Status:
  //  - Im Urlaub  → es liegt eine Abwesenheit vor
  //  - Im Termin  → heute ist mindestens ein Termin eingeplant
  //  - Verfügbar  → ansonsten frei
  function employeeStatus(e: EmployeeAvail): { status: string; label: string } {
    if (e.onAbsence) {
      return {
        status: e.absenceType === "KRANK" ? "KRANK" : "URLAUB",
        label: e.absenceType === "KRANK" ? "Krank" : "Im Urlaub",
      };
    }
    if (e.appointmentsToday.length > 0) {
      return { status: "IM_TERMIN", label: "Im Termin" };
    }
    return { status: "VERFUEGBAR", label: "Verfügbar" };
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Disposition</h1>
          <InfoButton title="Disposition">
            <p>
              In der Disposition können Aufträge Mitarbeitern, Teams oder Fahrzeugen zugewiesen
              werden. Die Ansicht hilft dabei, Termine und Ressourcen zu planen.
            </p>
            <p>
              Teams sind feste Kolonnen (Monteur + Helfer + Fahrzeug). Eigene Teams legen Sie
              unter „Teams verwalten“ an.
            </p>
          </InfoButton>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/leitstand">
            <Button variant="outline" size="lg">Leitstand</Button>
          </Link>
          <Link href="/dashboard/disposition/fahrzeuge">
            <Button variant="outline" size="lg">Fahrzeuge</Button>
          </Link>
          <Link href="/dashboard/disposition/teams">
            <Button variant="outline" size="lg">Teams verwalten</Button>
          </Link>
        </div>
      </div>

      {(critical?.materialIssues?.length ?? 0) > 0 && (
        <Card className="mb-6 !border-red-200 !bg-red-50">
          <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
            <AlertCircle className="h-5 w-5" /> Kritische Materialsituation
          </div>
          <p className="text-sm text-red-600">
            {critical!.materialIssues.length} Auftrag/Aufträge mit fehlendem Material
          </p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <Card title="Heute">
          <p className="text-3xl font-bold text-[#0d5c63]">{todayOrders.length}</p>
          <p className="text-sm text-slate-500">Einsätze geplant</p>
        </Card>
        <Card title="Verfügbar">
          <p className="text-3xl font-bold text-green-700">{employees.filter((e) => e.available).length}</p>
          <p className="text-sm text-slate-500">von {employees.length} Mitarbeitern</p>
        </Card>
        <Card title="Teams">
          <p className="text-3xl font-bold text-slate-700">{teams.length}</p>
          <p className="text-sm text-slate-500">aktive Teams</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Heutige Einsätze">
          <div className="divide-y divide-slate-50">
            {todayOrders.map((o) => (
              <Link
                key={o.id}
                href={`/dashboard/auftraege/${o.id}`}
                className="block py-3 hover:bg-slate-50 -mx-2 px-2 rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-[#0d5c63]">{o.orderNumber}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    o.materialAmpel === "red" ? "bg-red-100 text-red-700" :
                    o.materialAmpel === "yellow" ? "bg-yellow-100 text-yellow-700" :
                    "bg-green-100 text-green-700"
                  }`}>
                    {MATERIAL_STATUS_LABELS[o.materialStatus] ?? o.materialStatus}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{o.title}</p>
                <p className="text-xs text-slate-400">{o.customer} · {o.address}</p>
                {o.employees.length > 0 && (
                  <p className="text-xs text-slate-500 mt-1">{o.employees.join(", ")}</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {o.team && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[#0d5c63]/10 text-[#0d5c63]">
                      <Users className="h-3 w-3" /> {o.team}
                    </span>
                  )}
                  {o.vehicle && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      <Truck className="h-3 w-3" /> {o.vehicle.name}
                      {o.vehicle.licensePlate && ` (${o.vehicle.licensePlate})`}
                    </span>
                  )}
                </div>
              </Link>
            ))}
            {!todayOrders.length && (
              <p className="text-sm text-slate-500 py-4 text-center">Keine Einsätze heute.</p>
            )}
          </div>
        </Card>

        <Card title="Mitarbeiter-Verfügbarkeit">
          <div className="divide-y divide-slate-50">
            {employees.map((e) => (
              <div key={e.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium">{e.name}</p>
                  {e.teams.length > 0 && (
                    <p className="text-xs text-slate-400">{e.teams.join(", ")}</p>
                  )}
                  {e.appointmentsToday.map((a, i) => (
                    <p key={i} className="text-xs text-slate-500">
                      {a.orderNumber} · {formatDateTime(a.startTime)}
                    </p>
                  ))}
                </div>
                {(() => {
                  const s = employeeStatus(e);
                  return <Badge status={s.status} label={s.label} />;
                })()}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Teams & Fahrzeuge" className="mt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {teams.map((t) => (
            <div key={t.id} className="rounded-lg border border-slate-100 p-4">
              <div className="flex items-center gap-2 font-semibold">
                <Users className="h-4 w-4 text-[#0d5c63]" /> {t.name}
              </div>
              {t.vehicle && (
                <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5" />
                  {t.vehicle.name}
                  {t.vehicle.licensePlate && ` (${t.vehicle.licensePlate})`}
                </p>
              )}
              <ul className="mt-2 text-sm text-slate-600">
                {t.members.map((m) => (
                  <li key={m.employee.user.firstName}>
                    {m.employee.user.firstName} {m.employee.user.lastName}
                    {m.isForeman && " (Vorarbeiter)"}
                  </li>
                ))}
              </ul>
              {t.orders.length > 0 && (
                <p className="text-xs text-slate-400 mt-2">
                  {t.orders.length} offene Aufträge
                </p>
              )}
            </div>
          ))}
          {!teams.length && (
            <p className="text-sm text-slate-500 col-span-2 text-center py-4">
              Noch keine Teams angelegt. Demo-Seed erstellt ein Team nach db:seed.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
