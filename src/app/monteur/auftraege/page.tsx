"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/fetch-json";
import { ORDER_STATUS_LABELS, formatDateTime } from "@/lib/utils";
import { ClipboardPlus, Loader2, MapPin } from "lucide-react";

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  title: string | null;
  scheduledStart?: string | null;
  customer: { firstName: string; lastName: string };
  property?: { street: string; zipCode: string; city: string } | null;
}

type OrdersResponse = {
  orders: OrderRow[];
  scope?: string;
  canViewAll?: boolean;
  missingEmployeeProfile?: boolean;
};

function extractOrders(data: unknown): OrderRow[] {
  if (Array.isArray(data)) return data as OrderRow[];
  if (data && typeof data === "object" && Array.isArray((data as OrdersResponse).orders)) {
    return (data as OrdersResponse).orders;
  }
  return [];
}

export default function MonteurAuftraegePage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchJson<OrdersResponse | OrderRow[]>("/api/monteur/orders?scope=mine")
      .then((res) => {
        if (res.success) {
          setOrders(extractOrders(res.data));
          setError("");
        } else {
          setOrders([]);
          setError(res.error ?? "Aufträge konnten nicht geladen werden");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Meine Aufträge</h1>
          <p className="text-sm text-slate-500">Nur Ihre zugewiesenen Aufträge</p>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link href="/monteur/anfrage">
            <ClipboardPlus className="h-4 w-4" /> Anfrage
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Laden …
        </div>
      ) : error ? (
        <Card className="!p-6 text-center text-sm text-red-600">{error}</Card>
      ) : orders.length === 0 ? (
        <Card className="!p-6 text-center text-sm text-slate-500">
          Keine zugewiesenen Aufträge.
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Link key={o.id} href={`/monteur/auftrag/${o.id}`} className="block">
              <Card className="!p-4 transition-colors active:bg-slate-50 hover:border-[#0d5c63]/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#0d5c63]">{o.orderNumber}</p>
                    <p className="truncate text-sm text-slate-800">
                      {o.title || `${o.customer.firstName} ${o.customer.lastName}`}
                    </p>
                    <p className="text-xs text-slate-500">
                      {o.customer.firstName} {o.customer.lastName}
                      {o.scheduledStart ? ` · ${formatDateTime(o.scheduledStart)}` : ""}
                    </p>
                    {o.property && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {o.property.street}, {o.property.zipCode} {o.property.city}
                      </p>
                    )}
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                    {ORDER_STATUS_LABELS[o.status] ?? o.status}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
