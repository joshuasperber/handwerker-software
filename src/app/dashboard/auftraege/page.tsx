"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ORDER_STATUS_LABELS,
  formatDateTime,
  isOrderDone,
  isToday,
  isOverdue,
} from "@/lib/utils";
import { getCurrentPhase } from "@/lib/phase-status";
import { CanAccess } from "@/components/auth/can-access";
import { AddButton } from "@/components/ui/add-button";
import { Search } from "lucide-react";

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  scheduledStart: string | null;
  customer: { firstName: string; lastName: string; email: string };
  property: { street: string; city: string; zipCode: string };
  services: { service: { name: string } }[];
  phases?: { id: string; name: string; status: string; isEnabled: boolean; sortOrder: number }[];
}

export default function AuftraegePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");
  const [tab, setTab] = useState<"aktiv" | "erledigt">(
    searchParams.get("tab") === "erledigt" ? "erledigt" : "aktiv"
  );

  useEffect(() => {
    // Filterzustand bewusst mit den URL-Parametern synchronisieren.
    const urlStatus = searchParams.get("status");
    if (urlStatus && urlStatus !== statusFilter) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatusFilter(urlStatus);
    }
    const urlTab = searchParams.get("tab");
    if (urlTab === "erledigt" || urlTab === "aktiv") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTab(urlTab);
    }
  }, [searchParams, statusFilter]);

  const visibleOrders = orders.filter((o) =>
    tab === "erledigt" ? isOrderDone(o.status) : !isOrderDone(o.status)
  );
  const activeCount = orders.filter((o) => !isOrderDone(o.status)).length;
  const doneCount = orders.filter((o) => isOrderDone(o.status)).length;

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);

    fetch(`/api/orders?${params}`)
      .then((r) => r.json())
      .then((data) => { if (data.success) setOrders(data.data); });
  }, [search, statusFilter]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Aufträge</h1>
        <CanAccess permission="orders.write">
          <AddButton href="/dashboard/auftraege/neu">Neuer Auftrag</AddButton>
        </CanAccess>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
        >
          <option value="">Alle Status</option>
          {Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setTab("aktiv")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "aktiv"
              ? "bg-slate-900 text-white"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          Aktive Aufträge ({activeCount})
        </button>
        <button
          type="button"
          onClick={() => setTab("erledigt")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "erledigt"
              ? "bg-slate-900 text-white"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          Erledigt ({doneCount})
        </button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="pb-3 pl-3 pr-4 font-medium">Nr.</th>
                <th className="pb-3 pr-4 font-medium">Kunde</th>
                <th className="pb-3 pr-4 font-medium">Leistung</th>
                <th className="pb-3 pr-4 font-medium">Ort</th>
                <th className="pb-3 pr-4 font-medium hidden md:table-cell">Phase</th>
                <th className="pb-3 pr-4 font-medium">Termin</th>
                <th className="pb-3 pr-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visibleOrders.map((order) => {
                const overdue = isOverdue(order.scheduledStart, order.status);
                const today = !overdue && !isOrderDone(order.status) && isToday(order.scheduledStart);
                const currentPhase = getCurrentPhase(order.phases);
                return (
                  <tr
                    key={order.id}
                    className="hover:bg-slate-100 cursor-pointer transition-colors"
                    onClick={() => router.push(`/dashboard/auftraege/${order.id}`)}
                  >
                    <td className="py-3 pl-3 pr-4 font-medium text-[#0d5c63]">
                      {order.orderNumber}
                    </td>
                    <td className="py-3 pr-4">{order.customer.firstName} {order.customer.lastName}</td>
                    <td className="py-3 pr-4 text-slate-500">
                      {order.services.map((s) => s.service.name).join(", ")}
                    </td>
                    <td className="py-3 pr-4 text-slate-500">{order.property.city}</td>
                    <td className="py-3 pr-4 hidden md:table-cell">
                      {currentPhase ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              currentPhase.status === "IN_ARBEIT"
                                ? "bg-amber-500"
                                : currentPhase.status === "ABGESCHLOSSEN"
                                ? "bg-green-500"
                                : "bg-slate-300"
                            }`}
                          />
                          {currentPhase.name}
                        </span>
                      ) : (
                        <span className="text-slate-400">–</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-slate-500">
                      {order.scheduledStart ? formatDateTime(order.scheduledStart) : "–"}
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {overdue && <Badge status="UEBERFAELLIG" label="Überfällig" />}
                        {today && <Badge status="HEUTE" label="Heute" />}
                        <Badge status={order.status} label={ORDER_STATUS_LABELS[order.status]} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visibleOrders.length === 0 && (
            <p className="text-center text-slate-500 py-8">
              {tab === "erledigt"
                ? "Keine erledigten Aufträge."
                : "Keine aktiven Aufträge."}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
