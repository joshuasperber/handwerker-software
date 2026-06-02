"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Package, MapPin } from "lucide-react";
import { PICKUP_RESERVE_PERCENT } from "@/lib/monteur/pickup-list";

interface PickupAggregateLine {
  key: string;
  name: string;
  unit: string;
  isTool: boolean;
  totalRequired: number;
  totalPickup: number;
  reserved: boolean;
  storageLocation?: string;
  sources: { orderNumber: string; quantityRequired: number; pickupQty: number }[];
}

interface PickupByOrder {
  orderId: string;
  orderNumber: string;
  customerName: string;
  lines: {
    name: string;
    unit: string;
    isTool: boolean;
    quantityRequired: number;
    pickupQty: number;
    reserved: boolean;
    storageLocation?: string;
  }[];
}

interface MonteurMaterialViewProps {
  date: string;
  byOrder: PickupByOrder[];
  aggregated: PickupAggregateLine[];
  loading?: boolean;
}

export function MonteurMaterialView({ date, byOrder, aggregated, loading }: MonteurMaterialViewProps) {
  if (loading) return <p className="text-slate-500 py-8 text-center">Laden...</p>;

  const hasMaterial = aggregated.length > 0;

  return (
    <div className="space-y-4">
      <Card className="!p-4 bg-[#0d5c63]/5 border-[#0d5c63]/20">
        <p className="text-sm font-semibold text-[#0d5c63] flex items-center gap-2">
          <Package className="h-4 w-4" /> Material fürs Lager / Fahrzeug
        </p>
        <p className="text-xs text-slate-600 mt-1">
          Mitnahme-Liste für {date} · inkl. {PICKUP_RESERVE_PERCENT}% Reserve (bei 1 Stück +1 Ersatz)
        </p>
      </Card>

      {!hasMaterial ? (
        <Card><p className="text-center text-slate-500 py-8">Keine Materialien für diesen Tag.</p></Card>
      ) : (
        <>
          <Card title="Gesamt – alles mitnehmen">
            <div className="divide-y divide-slate-50">
              {aggregated.map((line) => (
                <div key={line.key} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">
                      {line.name}
                      {line.isTool && <span className="ml-2 text-xs text-slate-400">(Werkzeug)</span>}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Benötigt: {line.totalRequired} {line.unit} → mitnehmen: <strong>{line.totalPickup} {line.unit}</strong>
                    </p>
                    {line.storageLocation && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" /> {line.storageLocation}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {line.reserved ? (
                      <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Reserviert</span>
                    ) : (
                      <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Noch nicht reserviert</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {byOrder.map((order) => (
            <Card key={order.orderId} title={`${order.orderNumber} · ${order.customerName}`}>
              <Link href={`/monteur/auftrag/${order.orderId}`} className="text-xs text-[#0d5c63] hover:underline mb-2 inline-block">
                Auftrag öffnen →
              </Link>
              {order.lines.length === 0 ? (
                <p className="text-sm text-slate-500">Keine Packliste.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {order.lines.map((line, i) => (
                    <li key={i} className="flex justify-between gap-2 border-b border-slate-50 pb-2 last:border-0">
                      <span>
                        <strong>{line.name}</strong>
                        {line.isTool && " (Werkzeug)"}
                        {": "}{line.quantityRequired} {line.unit} → <strong>{line.pickupQty}</strong> mitnehmen
                        {line.storageLocation && ` · ${line.storageLocation}`}
                      </span>
                      {line.reserved ? (
                        <span className="text-xs text-green-700 shrink-0">✓ reserviert</span>
                      ) : (
                        <span className="text-xs text-amber-600 shrink-0">offen</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
