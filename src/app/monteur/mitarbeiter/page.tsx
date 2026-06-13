"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Mail, Users, Search } from "lucide-react";

interface Colleague {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  color: string;
  operationalStatus: string;
  teams: string[];
}

const STATUS_LABELS: Record<string, string> = {
  VERFUEGBAR: "Verfügbar",
  UNTERWEGS: "Unterwegs",
  BEIM_KUNDEN: "Beim Kunden",
  PAUSE: "Pause",
  KRANK: "Krank",
  URLAUB: "Urlaub",
  ABGESCHLOSSEN: "Feierabend",
};

function matchesSearch(c: Colleague, q: string) {
  const hay = [c.firstName, c.lastName, c.email, ...c.teams].join(" ").toLowerCase();
  return hay.includes(q);
}

export default function MonteurMitarbeiterPage() {
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/monteur/colleagues")
      .then((r) => r.json())
      .then((d) => { if (d.success) setColleagues(d.data); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return colleagues;
    return colleagues.filter((c) => matchesSearch(c, q));
  }, [colleagues, search]);

  if (loading) return <p className="text-slate-500">Laden…</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Mitarbeiter</h1>
        <p className="text-sm text-slate-500 mt-1">Kollegen aus gemeinsamen Teams und Aufträgen</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          className="pl-9"
          placeholder="Name, E-Mail, Team…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {colleagues.length === 0 ? (
        <Card><p className="text-center text-slate-500 py-8">Keine Kollegen in Ihren Teams gefunden.</p></Card>
      ) : filtered.length === 0 ? (
        <Card><p className="text-center text-slate-500 py-8">Keine Treffer für „{search}".</p></Card>
      ) : (
        <ul className="space-y-3">
          {filtered.map((c) => (
            <li key={c.id}>
              <Card className="!p-4">
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white text-sm font-semibold"
                    style={{ backgroundColor: c.color }}
                  >
                    {c.firstName.charAt(0)}{c.lastName.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{c.firstName} {c.lastName}</p>
                    <Badge variant="secondary" className="mt-1">
                      {STATUS_LABELS[c.operationalStatus] ?? c.operationalStatus}
                    </Badge>
                    {c.teams.length > 0 && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-2">
                        <Users className="h-3.5 w-3.5" /> {c.teams.join(", ")}
                      </p>
                    )}
                    <a href={`mailto:${c.email}`} className="text-sm text-[#0d5c63] flex items-center gap-1 mt-2">
                      <Mail className="h-4 w-4" /> {c.email}
                    </a>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
