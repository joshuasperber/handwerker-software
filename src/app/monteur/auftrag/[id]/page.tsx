"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronLeft,
  Package,
  CheckCircle,
  Clock,
  MapPin,
  Navigation,
  Phone,
  Play,
  Square,
} from "lucide-react";
import { OrderPhases, type OrderPhaseData } from "@/components/orders/order-phases";
import { PhotoGallery } from "@/components/orders/photo-gallery";
import { toast } from "sonner";
import { fetchJson } from "@/lib/fetch-json";
import { formatDateTime, ORDER_STATUS_LABELS } from "@/lib/utils";

interface MaterialLine {
  id: string;
  name: string;
  quantityRequired: number;
  quantityConsumed: number;
  unit: string;
  isTool: boolean;
}

export default function MonteurAuftragPage() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<{
    orderNumber: string;
    title: string | null;
    status: string;
    description: string | null;
    customer: {
      firstName: string;
      lastName: string;
      company: string | null;
      contactPerson: string | null;
      phone: string | null;
    };
    property: {
      label: string;
      street: string;
      zipCode: string;
      city: string;
    };
    checklists: { id: string; label: string; isChecked: boolean }[];
    materialLines: MaterialLine[];
    materialUsages: { name: string; quantity: number; unit: string }[];
    timeEntries: {
      id: string;
      startTime: string;
      endTime: string | null;
      breakMinutes: number;
    }[];
    phases?: OrderPhaseData[];
  } | null>(null);
  const [consumption, setConsumption] = useState<Record<string, number>>({});
  const [completionNotes, setCompletionNotes] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [timeBusy, setTimeBusy] = useState(false);

  const load = useCallback(() => {
    if (!id || typeof id !== "string") return;
    fetchJson<{
      orderNumber: string;
      title: string | null;
      status: string;
      description: string | null;
      customer: {
        firstName: string;
        lastName: string;
        company: string | null;
        contactPerson: string | null;
        phone: string | null;
      };
      property: { label: string; street: string; zipCode: string; city: string };
      checklists: { id: string; label: string; isChecked: boolean }[];
      materialLines: MaterialLine[];
      materialUsages: { name: string; quantity: number; unit: string }[];
      timeEntries: {
        id: string;
        startTime: string;
        endTime: string | null;
        breakMinutes: number;
      }[];
      phases?: OrderPhaseData[];
    }>(`/api/monteur/orders/${id}`).then((d) => {
      if (d.success && d.data) {
        setError("");
        setOrder(d.data);
        const init: Record<string, number> = {};
        for (const line of d.data.materialLines ?? []) {
          if (!line.isTool) {
            init[line.id] = Math.max(0, line.quantityRequired - line.quantityConsumed);
          }
        }
        setConsumption(init);
        return;
      }
      setOrder(null);
      setError(d.error ?? "Auftrag nicht gefunden");
    });
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function startWork() {
    setTimeBusy(true);
    setError("");
    const res = await fetch(`/api/monteur/orders/${id}/time`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startTime: new Date().toISOString(),
        activity: "Montage",
      }),
    });
    const data = await res.json();
    setTimeBusy(false);
    if (!data.success) {
      setError(data.error ?? "Arbeitszeit konnte nicht gestartet werden");
      return;
    }
    toast.success("Arbeitszeit läuft");
    load();
  }

  async function stopWork(entryId: string) {
    setTimeBusy(true);
    setError("");
    const res = await fetch(`/api/monteur/time/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endTime: new Date().toISOString() }),
    });
    const data = await res.json();
    setTimeBusy(false);
    if (!data.success) {
      setError(data.error ?? "Arbeitszeit konnte nicht beendet werden");
      return;
    }
    toast.success("Arbeitszeit beendet");
    load();
  }

  async function toggleChecklist(checklistId: string, isChecked: boolean) {
    const res = await fetch(`/api/monteur/orders/${id}/checklists`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checklistId, isChecked: !isChecked }),
    });
    const data = await res.json();
    if (!data.success) {
      toast.error(data.error ?? "Checkliste konnte nicht gespeichert werden");
      return;
    }
    load();
  }

  async function bookConsumption() {
    setError("");
    const lines = Object.entries(consumption)
      .filter(([, qty]) => qty > 0)
      .map(([lineId, quantityConsumed]) => ({ lineId, quantityConsumed }));
    if (!lines.length) return;
    const res = await fetch(`/api/monteur/orders/${id}/consumption`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines }),
    });
    const data = await res.json();
    if (data.success) {
      setMessage("Verbrauch gebucht");
      load();
    } else {
      setError(data.error ?? "Fehler beim Buchen");
    }
  }

  async function completeOrder() {
    setError("");
    setMessage("");
    const res = await fetch(`/api/monteur/orders/${id}/complete`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "ABGESCHLOSSEN",
        internalNotes: completionNotes,
        completionResult: "COMPLETED",
      }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success("Einsatz abgeschlossen", {
        description: "Gut gemacht! Der Auftrag ist jetzt abrechnungsbereit.",
      });
      setTimeout(() => router.push("/monteur/tagesplan"), 1200);
    } else {
      toast.error("Abschluss fehlgeschlagen", {
        description: data.error ?? "Bitte versuchen Sie es erneut.",
      });
      setError(data.error ?? "Abschluss fehlgeschlagen");
    }
  }

  if (!order) {
    if (error) {
      return (
        <div className="space-y-3">
          <Link href="/monteur/tagesplan" className="flex items-center gap-1 text-sm text-blue-600">
            <ChevronLeft className="h-4 w-4" /> Zurück zum Tagesplan
          </Link>
          <p className="text-sm text-red-600">{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={load}>
            Erneut versuchen
          </Button>
        </div>
      );
    }
    return <p className="text-slate-500">Wird geladen …</p>;
  }

  const packLines = (order.materialLines ?? []).filter((l) => !l.isTool);
  const openTimeEntry = order.timeEntries.find((entry) => !entry.endTime);
  const relevantChecklists = order.checklists.filter((item) => item.label.trim());
  const completedChecklists = relevantChecklists.filter((item) => item.isChecked).length;
  const checklistComplete = relevantChecklists.every((item) => item.isChecked);
  const isTerminal = ["ABRECHNUNGSBEREIT", "ABGERECHNET", "STORNIERT"].includes(
    order.status
  );
  const customerName =
    order.customer.company || `${order.customer.firstName} ${order.customer.lastName}`;
  const address = `${order.property.street}, ${order.property.zipCode} ${order.property.city}`;

  return (
    <div>
      <Link href="/monteur/tagesplan" className="flex items-center gap-1 text-sm text-blue-600 mb-4">
        <ChevronLeft className="h-4 w-4" /> Zurück zum Tagesplan
      </Link>

      <div className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {order.orderNumber}
            </p>
            <h1 className="text-xl font-bold text-slate-900">
              {order.title || customerName}
            </h1>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
            {ORDER_STATUS_LABELS[order.status] ?? order.status}
          </span>
        </div>
      </div>

      <Card className="mb-4 !p-4">
        <p className="font-semibold text-slate-900">{customerName}</p>
        {order.customer.contactPerson && (
          <p className="mt-0.5 text-sm text-slate-500">
            Ansprechpartner: {order.customer.contactPerson}
          </p>
        )}
        <p className="mt-2 flex items-start gap-2 text-sm text-slate-600">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{address}</span>
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {order.customer.phone && (
            <Button asChild size="touch" variant="outline" className="w-full">
              <a href={`tel:${order.customer.phone}`}>
                <Phone className="mr-1 h-4 w-4" aria-hidden="true" /> Anrufen
              </a>
            </Button>
          )}
          <Button
            asChild
            size="touch"
            variant="action"
            className={order.customer.phone ? "w-full" : "col-span-2 w-full"}
          >
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noreferrer"
            >
              <Navigation className="mr-1 h-4 w-4" aria-hidden="true" /> Navigation
            </a>
          </Button>
        </div>
        {order.description && (
          <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-700">
            {order.description}
          </p>
        )}
      </Card>

      <Card title="Arbeitszeit" className="mb-4">
        {openTimeEntry ? (
          <>
            <p className="mb-3 flex items-center gap-2 text-sm text-green-700">
              <Clock className="h-4 w-4" aria-hidden="true" />
              Läuft seit {formatDateTime(openTimeEntry.startTime)}
            </p>
            <Button
              size="touch"
              variant="action"
              className="w-full"
              disabled={timeBusy}
              onClick={() => stopWork(openTimeEntry.id)}
            >
              <Square className="mr-1 h-4 w-4" aria-hidden="true" />
              {timeBusy ? "Wird beendet…" : "Arbeit beenden"}
            </Button>
          </>
        ) : (
          <Button
            size="touch"
            variant="action"
            className="w-full"
            disabled={timeBusy || isTerminal}
            onClick={startWork}
          >
            <Play className="mr-1 h-4 w-4" aria-hidden="true" />
            {timeBusy ? "Wird gestartet…" : "Arbeit starten"}
          </Button>
        )}
        {isTerminal && !openTimeEntry && (
          <p className="mt-2 text-center text-xs text-slate-500">
            Für abgeschlossene Aufträge ist keine neue Zeitbuchung möglich.
          </p>
        )}
      </Card>

      <Card title="Checkliste" className="mb-4">
        {relevantChecklists.length === 0 ? (
          <p className="text-sm text-slate-500">Keine Checkliste erforderlich.</p>
        ) : (
          <div className="space-y-1">
            <p className="mb-2 text-xs text-slate-500">
              {completedChecklists} von {relevantChecklists.length} erledigt
            </p>
            {relevantChecklists.map((item) => (
              <label
                key={item.id}
                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-1 py-2"
              >
                <input
                  type="checkbox"
                  checked={item.isChecked}
                  disabled={isTerminal}
                  onChange={() => toggleChecklist(item.id, item.isChecked)}
                  className="h-6 w-6 shrink-0"
                />
                <span className={item.isChecked ? "text-slate-400 line-through" : "text-slate-800"}>
                  {item.label}
                </span>
              </label>
            ))}
          </div>
        )}
      </Card>

      <div className="mb-4">
        <OrderPhases
          orderId={id as string}
          phases={order.phases ?? []}
          teams={[]}
          employees={[]}
          canEdit
          allowStructureEdit={false}
          phasesApiBase={`/api/monteur/orders/${id}/phases`}
          onChanged={load}
          filesBaseUrl={`/api/monteur/orders/${id}/files`}
          canManageFiles
        />
      </div>

      <Card title="Fotos & Dokumentation" className="mb-4">
        <p className="text-xs text-slate-500 -mt-1 mb-1">
          Aufmaß, Baustelle, Schäden, Montage … – direkt mit der Kamera aufnehmen oder aus der Galerie hochladen.
        </p>
        <PhotoGallery
          baseUrl={`/api/monteur/orders/${id}/files`}
          canUpload
          canDelete
          phases={(order.phases ?? []).map((p) => ({ id: p.id, name: p.name }))}
          compact
          onChanged={load}
        />
      </Card>

      {packLines.length > 0 && (
        <Card title="Packliste & Verbrauch" className="mb-4">
          <div className="space-y-3">
            {packLines.map((line) => (
              <div key={line.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-slate-400" />
                  <span>{line.name}</span>
                  <span className="text-slate-400">
                    ({line.quantityConsumed}/{line.quantityRequired} {line.unit})
                  </span>
                </div>
                <NumberInput
                  className="!w-20"
                  min={0}
                  disabled={isTerminal}
                  value={consumption[line.id] ?? 0}
                  onValueChange={(v) => setConsumption({ ...consumption, [line.id]: v ?? 0 })}
                />
              </div>
            ))}
            <Button size="sm" className="w-full" disabled={isTerminal} onClick={bookConsumption}>
              Verbrauch buchen
            </Button>
            {isTerminal && (
              <p className="text-center text-xs text-slate-500">
                Nach Abschluss ist keine weitere Verbrauchsbuchung möglich.
              </p>
            )}
          </div>
        </Card>
      )}

      {order.materialUsages.length > 0 && (
        <Card title="Gebuchter Verbrauch" className="mb-4">
          {order.materialUsages.map((m, i) => (
            <p key={i} className="text-sm py-1">{m.name}: {m.quantity} {m.unit}</p>
          ))}
        </Card>
      )}

      <Card title="Abschlussdokumentation">
        <ol className="space-y-2 text-sm mb-4">
          <li className="text-green-700">1. Verbrauch buchen {packLines.length === 0 ? "(optional – keine Packliste)" : ""}</li>
          <li className="text-slate-600">2. Abschlussnotizen erfassen</li>
          <li className="text-slate-600">3. Einsatz abschließen</li>
        </ol>
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        {message && <p className="text-sm text-green-700 mb-2">{message}</p>}
        <Textarea
          label="Abschlussnotizen"
          value={completionNotes}
          onChange={(e) => setCompletionNotes(e.target.value)}
          placeholder="Durchgeführte Arbeiten, Hinweise für den Kunden..."
          rows={4}
        />
        {!isTerminal && (
          <Button
            className="mt-3 w-full"
            variant="action"
            disabled={Boolean(openTimeEntry) || !checklistComplete}
            onClick={completeOrder}
          >
            <CheckCircle className="h-4 w-4 mr-1" aria-hidden="true" /> Einsatz abschließen
          </Button>
        )}
        {openTimeEntry && (
          <p className="mt-2 text-center text-xs text-amber-700">
            Vor dem Abschluss zuerst die Arbeitszeit beenden.
          </p>
        )}
        {!checklistComplete && (
          <p className="mt-2 text-center text-xs text-amber-700">
            Vor dem Abschluss zuerst die Checkliste erledigen.
          </p>
        )}
        {order.status === "ABRECHNUNGSBEREIT" && (
          <p className="text-xs text-green-600 mt-2 text-center">Bereits abgeschlossen – abrechnungsbereit</p>
        )}
        {order.status === "ABGERECHNET" && (
          <p className="mt-2 text-center text-xs text-green-700">Auftrag ist bereits abgerechnet.</p>
        )}
        {order.status === "STORNIERT" && (
          <p className="mt-2 text-center text-xs text-red-700">Auftrag wurde storniert.</p>
        )}
      </Card>
    </div>
  );
}
