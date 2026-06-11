"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchJson } from "@/lib/fetch-json";
import { ORDER_STATUS_LABELS, formatDate } from "@/lib/utils";
import { Share2, MapPin, User } from "lucide-react";

interface SharedItem {
  shareId: string;
  note: string | null;
  sharedAt: string;
  sharedBy: string | null;
  order: {
    id: string;
    orderNumber: string;
    title: string | null;
    status: string;
    description: string | null;
    createdAt: string;
    customer: string;
    location: string;
    services: string[];
  };
}

export default function PortalSharedPage() {
  const [items, setItems] = useState<SharedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJson<SharedItem[]>("/api/shared").then((d) => {
      if (d.success && d.data) setItems(d.data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Share2 className="h-5 w-5 text-[#0d5c63]" /> Mit mir geteilt
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Hier sehen Sie ausschließlich die Anfragen, die ausdrücklich mit Ihnen geteilt wurden.
        </p>
      </div>

      {loading ? (
        <Card><p className="text-center text-slate-500 py-8">Wird geladen...</p></Card>
      ) : items.length === 0 ? (
        <Card><p className="text-center text-slate-500 py-8">Es wurde noch nichts mit Ihnen geteilt.</p></Card>
      ) : (
        items.map((item) => (
          <Card key={item.shareId} className="!p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">
                  {item.order.title || item.order.orderNumber}
                </p>
                <p className="text-xs text-slate-400">{item.order.orderNumber}</p>
              </div>
              <Badge status={item.order.status} label={ORDER_STATUS_LABELS[item.order.status] ?? item.order.status} />
            </div>

            <div className="mt-3 space-y-1.5 text-sm text-slate-600">
              <p className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-slate-400" /> {item.order.customer}</p>
              <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-slate-400" /> {item.order.location}</p>
            </div>

            {item.order.services.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.order.services.map((s, i) => (
                  <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{s}</span>
                ))}
              </div>
            )}

            {item.order.description && (
              <p className="mt-3 text-sm text-slate-700 whitespace-pre-wrap">{item.order.description}</p>
            )}

            {item.note && (
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-100 p-2.5 text-sm text-amber-800">
                {item.note}
              </div>
            )}

            <p className="mt-3 text-xs text-slate-400">
              Geteilt{item.sharedBy ? ` von ${item.sharedBy}` : ""} · {formatDate(item.sharedAt)}
            </p>
          </Card>
        ))
      )}
    </div>
  );
}
