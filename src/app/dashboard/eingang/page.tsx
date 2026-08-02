"use client";

import { useState } from "react";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { saveJson } from "@/lib/save-toast";
import { useApiSWR } from "@/lib/swr";

type WorkRequest = {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  urgency: string;
  estimatedHours: number | null;
  materialNotes: string | null;
  addressNote: string | null;
  createdAt: string;
  reviewNote: string | null;
  convertedOrderId: string | null;
  createdBy: { firstName: string; lastName: string };
  customer: { id: string; firstName: string; lastName: string; company: string | null } | null;
  order: { id: string; orderNumber: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Entwurf",
  SUBMITTED: "Zur Prüfung",
  ACCEPTED: "Angenommen",
  REJECTED: "Abgelehnt",
  CONVERTED: "In Auftrag",
  ARCHIVED: "Archiviert",
};

const TYPE_LABELS: Record<string, string> = {
  ZUSATZARBEIT: "Zusatzarbeit",
  NEUE_ANFRAGE: "Neue Anfrage",
  MATERIAL_FEHLT: "Material fehlt",
  SCHADEN: "Schaden",
  RUECKFRAGE: "Rückfrage",
  SONSTIGES: "Sonstiges",
};

export default function EingangsboxPage() {
  const { data: items = [], mutate, isLoading } = useApiSWR<WorkRequest[]>("/api/work-requests");
  const [filter, setFilter] = useState("SUBMITTED");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = items.filter((i) => (filter === "all" ? true : i.status === filter));

  async function act(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    const res = await saveJson(
      `/api/work-requests/${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      { error: "Aktion fehlgeschlagen", success: "Aktualisiert" }
    );
    setBusyId(null);
    if (res.success) void mutate();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Inbox className="h-7 w-7 text-[#0d5c63]" />
            Eingangsbox
          </h1>
          <p className="text-sm text-slate-500">
            Anfragen und Meldungen aus der Arbeitsansicht prüfen und übernehmen.
          </p>
        </div>
        <select
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="SUBMITTED">Zur Prüfung</option>
          <option value="all">Alle</option>
          <option value="ACCEPTED">Angenommen</option>
          <option value="REJECTED">Abgelehnt</option>
          <option value="CONVERTED">Umgewandelt</option>
          <option value="ARCHIVED">Archiv</option>
          <option value="DRAFT">Entwürfe</option>
        </select>
      </div>

      {isLoading && <p className="text-sm text-slate-500">Laden…</p>}
      {!isLoading && filtered.length === 0 && (
        <Card>
          <p className="text-sm text-slate-500">Keine Meldungen in diesem Filter.</p>
        </Card>
      )}

      <div className="space-y-4">
        {filtered.map((item) => (
          <Card key={item.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500">
                  {TYPE_LABELS[item.type] ?? item.type} · {STATUS_LABELS[item.status] ?? item.status} ·{" "}
                  {item.urgency} · {new Date(item.createdAt).toLocaleString("de-DE")}
                </p>
              </div>
              <p className="text-xs text-slate-500">
                von {item.createdBy.firstName} {item.createdBy.lastName}
              </p>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.description}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
              {item.customer && (
                <span>
                  Kunde: {item.customer.company || `${item.customer.firstName} ${item.customer.lastName}`}
                </span>
              )}
              {item.order && (
                <Link href={`/dashboard/auftraege/${item.order.id}`} className="text-[#0d5c63] underline">
                  Auftrag {item.order.orderNumber}
                </Link>
              )}
              {item.addressNote && <span>Adresse: {item.addressNote}</span>}
              {item.estimatedHours != null && <span>Aufwand: {item.estimatedHours} h</span>}
              {item.materialNotes && <span>Material: {item.materialNotes}</span>}
              {item.convertedOrderId && (
                <Link
                  href={`/dashboard/auftraege/${item.convertedOrderId}`}
                  className="text-[#0d5c63] underline"
                >
                  Neuer Auftrag öffnen
                </Link>
              )}
            </div>
            {item.status === "SUBMITTED" && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="action"
                  disabled={busyId === item.id || !item.customer}
                  title={!item.customer ? "Kunde erforderlich" : undefined}
                  onClick={() => void act(item.id, { convertToOrder: true })}
                >
                  In Auftrag umwandeln
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === item.id}
                  onClick={() => void act(item.id, { status: "ACCEPTED" })}
                >
                  Annehmen
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === item.id}
                  onClick={() => void act(item.id, { status: "REJECTED", reviewNote: "Abgelehnt" })}
                >
                  Ablehnen
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === item.id}
                  onClick={() => void act(item.id, { status: "ARCHIVED" })}
                >
                  Archivieren
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
