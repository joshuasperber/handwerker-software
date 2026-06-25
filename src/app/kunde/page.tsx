"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchJson } from "@/lib/fetch-json";
import { ORDER_STATUS_LABELS, formatDate, orderServiceLabel } from "@/lib/utils";
import { ClipboardList, MapPin } from "lucide-react";

interface CustomerOrder {
  id: string;
  orderNumber: string;
  title: string | null;
  status: string;
  description: string | null;
  scheduledStart: string | null;
  createdAt: string;
  property: { street: string; city: string } | null;
  services: { service: { name: string } | null; customName?: string | null }[];
}

export default function KundePage() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchJson<CustomerOrder[]>("/api/customer/orders").then((d) => {
      if (d.success && d.data) {
        setOrders(d.data);
        setError("");
      } else {
        setError(d.error ?? "Aufträge konnten nicht geladen werden");
      }
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-[#0d5c63]" /> Meine Aufträge
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Hier sehen Sie den Status Ihrer Anfragen beim Handwerksbetrieb.
        </p>
      </div>

      {loading ? (
        <Card><p className="text-center text-slate-500 py-8">Wird geladen…</p></Card>
      ) : error ? (
        <Card><p className="text-center text-red-600 py-8">{error}</p></Card>
      ) : orders.length === 0 ? (
        <Card>
          <p className="text-center text-slate-500 py-8">
            Noch keine Aufträge verknüpft. Bitte wenden Sie sich an Ihren Handwerksbetrieb,
            falls Sie Zugang erwartet haben.
          </p>
        </Card>
      ) : (
        orders.map((o) => (
          <Card key={o.id} className="!p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{o.title || o.orderNumber}</p>
                <p className="text-sm text-slate-500">{o.orderNumber}</p>
              </div>
              <Badge variant="secondary">{ORDER_STATUS_LABELS[o.status] ?? o.status}</Badge>
            </div>
            {o.description && <p className="text-sm text-slate-600 mt-2">{o.description}</p>}
            {o.property && (
              <p className="text-sm text-slate-500 flex items-center gap-1 mt-2">
                <MapPin className="h-4 w-4 shrink-0" />
                {o.property.street}, {o.property.city}
              </p>
            )}
            {o.services.length > 0 && (
              <p className="text-xs text-slate-400 mt-2">
                {o.services.map((s) => orderServiceLabel(s)).join(" · ")}
              </p>
            )}
            <p className="text-xs text-slate-400 mt-2">
              {o.scheduledStart
                ? `Termin: ${formatDate(o.scheduledStart)}`
                : `Angelegt: ${formatDate(o.createdAt)}`}
            </p>
          </Card>
        ))
      )}
    </div>
  );
}
