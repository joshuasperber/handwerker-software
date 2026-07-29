"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CanAccess } from "@/components/auth/can-access";
import { AddButton } from "@/components/ui/add-button";
import { fetchJson } from "@/lib/fetch-json";
import { formatDate } from "@/lib/utils";
import { FolderKanban, Search } from "lucide-react";
import { PROJECT_STATUS_LABELS } from "@/lib/projects/types";
import { toast } from "sonner";

interface ProjectListItem {
  id: string;
  name: string;
  status: string;
  statusLabel: string;
  startDate: string | null;
  endDate: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  customer: { id: string; name: string };
  team: { id: string; name: string } | null;
  counts: { orders: number; notesEntries: number; files: number; costs: number };
}

const STATUS_STYLES: Record<string, string> = {
  GEPLANT: "bg-slate-100 text-slate-700",
  AKTIV: "bg-emerald-100 text-emerald-800",
  PAUSIERT: "bg-amber-100 text-amber-800",
  ABGESCHLOSSEN: "bg-blue-100 text-blue-800",
  ABGERECHNET: "bg-teal-100 text-teal-800",
  STORNIERT: "bg-rose-100 text-rose-800",
};

export default function ProjektePage() {
  const router = useRouter();
  const [items, setItems] = useState<ProjectListItem[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (status) params.set("status", status);
      const res = await fetchJson<ProjectListItem[]>(`/api/projects?${params}`);
      if (res.success && res.data) {
        setItems(res.data);
      } else {
        toast.error(res.error ?? "Projekte konnten nicht geladen werden");
      }
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [search, status]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <FolderKanban className="h-7 w-7 text-[#0d5c63]" />
            Projekte
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Größere Vorhaben mit mehreren Aufträgen, Fotos, Notizen und Kosten
          </p>
        </div>
        <CanAccess permission="orders.write">
          <AddButton href="/dashboard/projekte/neu">Neues Projekt</AddButton>
        </CanAccess>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Projekt, Kunde oder Adresse …"
            className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">Alle Status</option>
          {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-500">Wird geladen …</p>
      ) : items.length === 0 ? (
        <Card className="!p-8 text-center text-sm text-slate-500">
          Noch keine Projekte. Lege ein größeres Vorhaben an, z.&nbsp;B. „Hausbau Friedrichstraße“.
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer !p-4 transition-colors hover:bg-slate-50"
              onClick={() => router.push(`/dashboard/projekte/${p.id}`)}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-900">{p.name}</h2>
                    <Badge className={`border-0 ${STATUS_STYLES[p.status] ?? ""}`}>
                      {p.statusLabel}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{p.customer.name}</p>
                  {(p.addressStreet || p.addressCity) && (
                    <p className="text-xs text-slate-400">
                      {[p.addressStreet, p.addressCity].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-left text-xs text-slate-500 sm:text-right">
                  <p>{p.counts.orders} Auftrag(e)</p>
                  <p>
                    {p.counts.files} Foto(s) · {p.counts.notesEntries} Notiz(en) ·{" "}
                    {p.counts.costs} Kosten
                  </p>
                  {p.startDate && <p>Start {formatDate(p.startDate)}</p>}
                  {p.team && <p>Team {p.team.name}</p>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
