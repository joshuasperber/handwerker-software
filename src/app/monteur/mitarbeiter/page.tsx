"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  ClipboardList,
  Handshake,
  Mail,
  MapPin,
  Phone,
  Search,
  Users,
} from "lucide-react";
import { ORDER_STATUS_LABELS, ROLE_LABELS, formatDateTime } from "@/lib/utils";

interface Colleague {
  id: string;
  userId?: string;
  kind: "mitarbeiter" | "partner";
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role?: string;
  color: string;
  operationalStatus: string;
  teams: string[];
  isTeamColleague?: boolean;
  group?: "team" | "company" | "partner";
}

interface TeamOrder {
  id: string;
  orderNumber: string;
  title: string | null;
  status: string;
  scheduledStart: string | null;
  customerName: string;
  address: string | null;
  assignees: { id: string; name: string; color: string }[];
  nextAppointment: { startTime: string; employeeName: string | null } | null;
}

type Tab = "kollegen" | "auftraege";

const STATUS_LABELS: Record<string, string> = {
  VERFUEGBAR: "Verfügbar",
  UNTERWEGS: "Unterwegs",
  BEIM_KUNDEN: "Beim Kunden",
  PAUSE: "Pause",
  KRANK: "Krank",
  URLAUB: "Urlaub",
  ABGESCHLOSSEN: "Feierabend",
  PARTNER: "Partner",
};

function matchesColleague(c: Colleague, q: string) {
  return [c.firstName, c.lastName, c.email, c.phone ?? "", c.role ?? "", ...c.teams]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

export default function MonteurMitarbeiterPage() {
  const [tab, setTab] = useState<Tab>("kollegen");
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [hasTeamColleagues, setHasTeamColleagues] = useState(false);
  const [orders, setOrders] = useState<TeamOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");

  useEffect(() => {
    fetch("/api/monteur/colleagues")
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        const payload = d.data;
        if (Array.isArray(payload)) {
          setColleagues(payload);
          setHasTeamColleagues(payload.some((c: Colleague) => c.isTeamColleague));
        } else {
          setColleagues(payload.colleagues ?? []);
          setHasTeamColleagues(Boolean(payload.hasTeamColleagues));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab !== "auftraege") return;
    setOrdersLoading(true);
    const qs = employeeFilter ? `?employeeId=${encodeURIComponent(employeeFilter)}` : "";
    fetch(`/api/monteur/team-orders${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setOrders(d.data);
      })
      .finally(() => setOrdersLoading(false));
  }, [tab, employeeFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return colleagues;
    return colleagues.filter((c) => matchesColleague(c, q));
  }, [colleagues, search]);

  const teamStaff = filtered.filter((c) => c.kind !== "partner" && c.isTeamColleague);
  const companyStaff = filtered.filter((c) => c.kind !== "partner" && !c.isTeamColleague);
  const partners = filtered.filter((c) => c.kind === "partner");
  const staffForFilter = colleagues.filter((c) => c.kind !== "partner");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Team</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kollegen, Partner und Aufträge im Betrieb
          </p>
        </div>
        <Link
          href="/monteur/kalender"
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[#0d5c63] px-3 text-sm font-medium text-white active:scale-[0.98]"
        >
          <CalendarDays className="h-4 w-4" />
          Kalender
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        {(
          [
            { id: "kollegen" as const, label: "Kollegen", icon: Users },
            { id: "auftraege" as const, label: "Aufträge", icon: ClipboardList },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "kollegen" && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Name, E-Mail, Team…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Laden…</p>
          ) : colleagues.length === 0 ? (
            <Card>
              <p className="py-8 text-center text-slate-500">
                Noch keine Kollegen oder Partner gefunden.
              </p>
            </Card>
          ) : filtered.length === 0 ? (
            <Card>
              <p className="py-8 text-center text-slate-500">
                Keine Treffer für &quot;{search}&quot;.
              </p>
            </Card>
          ) : (
            <div className="space-y-6">
              {hasTeamColleagues && teamStaff.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Teamkollegen ({teamStaff.length})
                  </h2>
                  <ColleagueList items={teamStaff} />
                </section>
              )}

              {companyStaff.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    {hasTeamColleagues
                      ? `Weitere Unternehmenskollegen (${companyStaff.length})`
                      : `Unternehmenskollegen (${companyStaff.length})`}
                  </h2>
                  <ColleagueList items={companyStaff} />
                </section>
              )}

              {partners.length > 0 && (
                <section className="space-y-3">
                  <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                    <Handshake className="h-4 w-4" /> Unternehmenspartner ({partners.length})
                  </h2>
                  <ColleagueList items={partners} />
                </section>
              )}
            </div>
          )}
        </>
      )}

      {tab === "auftraege" && (
        <div className="space-y-3">
          <select
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
          >
            <option value="">Alle Mitarbeiter</option>
            {staffForFilter.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </select>

          {ordersLoading ? (
            <p className="text-sm text-slate-500">Aufträge laden…</p>
          ) : orders.length === 0 ? (
            <Card>
              <p className="py-8 text-center text-sm text-slate-500">
                Keine Aufträge für die Auswahl gefunden.
              </p>
            </Card>
          ) : (
            <ul className="space-y-3">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/monteur/auftrag/${o.id}`} className="block">
                    <Card className="!p-4 transition-colors active:bg-slate-50 hover:border-[#0d5c63]/30">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-[#0d5c63]">{o.orderNumber}</p>
                          <p className="truncate text-sm text-slate-800">
                            {o.title || o.customerName}
                          </p>
                          <p className="text-xs text-slate-500">{o.customerName}</p>
                          {o.address && (
                            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              {o.address}
                            </p>
                          )}
                          {o.assignees.length > 0 && (
                            <p className="mt-1 text-xs text-slate-500">
                              {o.assignees.map((a) => a.name).join(", ")}
                            </p>
                          )}
                          {o.nextAppointment && (
                            <p className="mt-1 text-xs text-slate-500">
                              Termin: {formatDateTime(o.nextAppointment.startTime)}
                              {o.nextAppointment.employeeName
                                ? ` · ${o.nextAppointment.employeeName}`
                                : ""}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          {ORDER_STATUS_LABELS[o.status] ?? o.status}
                        </Badge>
                      </div>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ColleagueList({ items }: { items: Colleague[] }) {
  return (
    <ul className="space-y-3">
      {items.map((c) => (
        <li key={c.id}>
          <Card className="!p-4">
            <div className="flex items-start gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: c.color }}
              >
                {c.firstName.charAt(0)}
                {c.lastName.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">
                  {c.firstName} {c.lastName}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge variant="secondary">
                    {STATUS_LABELS[c.operationalStatus] ?? c.operationalStatus}
                  </Badge>
                  {c.role && (
                    <Badge variant="outline">{ROLE_LABELS[c.role] ?? c.role}</Badge>
                  )}
                </div>
                {c.teams.length > 0 && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                    <Users className="h-3.5 w-3.5" /> {c.teams.join(", ")}
                  </p>
                )}
                <div className="mt-2 flex flex-col gap-1">
                  <a
                    href={`mailto:${c.email}`}
                    className="flex items-center gap-1 text-sm text-[#0d5c63]"
                  >
                    <Mail className="h-4 w-4" /> {c.email}
                  </a>
                  {c.phone && (
                    <a
                      href={`tel:${c.phone}`}
                      className="flex items-center gap-1 text-sm text-[#0d5c63]"
                    >
                      <Phone className="h-4 w-4" /> {c.phone}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
