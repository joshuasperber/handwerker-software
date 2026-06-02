"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, Package, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface MaterialLine {
  id: string;
  name: string;
  quantityRequired: number;
  unit: string;
  isTool: boolean;
}

export default function MonteurAuftragPage() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<{
    orderNumber: string;
    status: string;
    description: string | null;
    materialLines: MaterialLine[];
    materialUsages: { name: string; quantity: number; unit: string }[];
    timeEntries: { startTime: string; endTime: string | null }[];
  } | null>(null);
  const [consumption, setConsumption] = useState<Record<string, number>>({});
  const [completionNotes, setCompletionNotes] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function load() {
    fetch(`/api/orders/${id}`).then((r) => r.json()).then((d) => {
      if (d.success) {
        setOrder(d.data);
        const init: Record<string, number> = {};
        for (const line of d.data.materialLines ?? []) {
          if (!line.isTool) init[line.id] = line.quantityRequired;
        }
        setConsumption(init);
      }
    });
  }

  useEffect(() => { load(); }, [id]);

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
      setTimeout(() => router.push("/monteur"), 1200);
    } else {
      toast.error("Abschluss fehlgeschlagen", {
        description: data.error ?? "Bitte versuchen Sie es erneut.",
      });
      setError(data.error ?? "Abschluss fehlgeschlagen");
    }
  }

  if (!order) return <p className="text-slate-500">Laden...</p>;

  const packLines = (order.materialLines ?? []).filter((l) => !l.isTool);

  return (
    <div>
      <Link href="/monteur" className="flex items-center gap-1 text-sm text-blue-600 mb-4">
        <ChevronLeft className="h-4 w-4" /> Zurück zum Tagesplan
      </Link>

      <h1 className="text-xl font-bold mb-4">{order.orderNumber}</h1>
      {order.description && <p className="text-sm text-slate-600 mb-4">{order.description}</p>}

      {packLines.length > 0 && (
        <Card title="Packliste & Verbrauch" className="mb-4">
          <div className="space-y-3">
            {packLines.map((line) => (
              <div key={line.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-slate-400" />
                  <span>{line.name}</span>
                  <span className="text-slate-400">({line.quantityRequired} {line.unit})</span>
                </div>
                <Input
                  type="number"
                  className="!w-20"
                  value={consumption[line.id] ?? 0}
                  onChange={(e) => setConsumption({ ...consumption, [line.id]: parseFloat(e.target.value) || 0 })}
                />
              </div>
            ))}
            <Button size="sm" className="w-full" onClick={bookConsumption}>
              Verbrauch buchen
            </Button>
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
        <Button className="mt-3 w-full" variant="action" onClick={completeOrder}>
          <CheckCircle className="h-4 w-4 mr-1" /> Einsatz abschließen
        </Button>
        {order.status === "ABRECHNUNGSBEREIT" && (
          <p className="text-xs text-green-600 mt-2 text-center">Bereits abgeschlossen – abrechnungsbereit</p>
        )}
      </Card>
    </div>
  );
}
