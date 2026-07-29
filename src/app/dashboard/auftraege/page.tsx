"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ORDER_STATUS_LABELS,
  formatDateTime,
  isOrderDone,
  isToday,
  isOverdue,
  orderServiceLabel,
} from "@/lib/utils";
import { getCurrentPhase } from "@/lib/phase-status";
import { CanAccess } from "@/components/auth/can-access";
import { AddButton } from "@/components/ui/add-button";
import { swrKeys, useApiSWR } from "@/lib/swr";
import { ChevronRight, ClipboardList, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  title?: string | null;
  scheduledStart: string | null;
  customer: { firstName: string; lastName: string; email: string };
  property: { street: string; city: string; zipCode: string };
  services: { service: { name: string } | null; customName?: string | null }[];
  phases?: { id: string; name: string; status: string; isEnabled: boolean; sortOrder: number }[];
}

export default function AuftraegePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");
  const [tab, setTab] = useState<"aktiv" | "erledigt">(
    searchParams.get("tab") === "erledigt" ? "erledigt" : "aktiv"
  );

  useEffect(() => {
    const urlStatus = searchParams.get("status");
    if (urlStatus && urlStatus !== statusFilter) {
      setStatusFilter(urlStatus);
    }
    const urlTab = searchParams.get("tab");
    if (urlTab === "erledigt" || urlTab === "aktiv") {
      setTab(urlTab);
    }
  }, [searchParams, statusFilter]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    return params.toString();
  }, [search, statusFilter]);

  const { data: orders = [], error, isLoading } = useApiSWR<Order[]>(
    swrKeys.orders(queryString)
  );

  useEffect(() => {
    if (error) toast.error(error.message || "Aufträge konnten nicht geladen werden");
  }, [error]);

  const visibleOrders = orders.filter((o) =>
    tab === "erledigt" ? isOrderDone(o.status) : !isOrderDone(o.status)
  );
  const activeCount = orders.filter((o) => !isOrderDone(o.status)).length;
  const doneCount = orders.filter((o) => isOrderDone(o.status)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-[#0d5c63]" />
            Aufträge
          </h1>
          <p className="mt-1 text-sm text-slate-500">Neueste zuerst</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <CanAccess permission="orders.write">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/auftraege/typen">Auftragstypen</Link>
            </Button>
          </CanAccess>
          <CanAccess permission="orders.write">
            <AddButton href="/dashboard/auftraege/neu" className="hidden sm:inline-flex">
              Neuer Auftrag
            </AddButton>
          </CanAccess>
        </div>
      </div>

      <CanAccess permission="orders.write">
        <AddButton href="/dashboard/auftraege/neu" className="w-full sm:hidden">
          Neuer Auftrag
        </AddButton>
      </CanAccess>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="search"
            placeholder="Nr., Kunde suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 sm:h-10 pl-10 pr-4 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d5c63]/30"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-11 sm:h-10 rounded-xl border border-slate-300 px-3 text-sm bg-white"
        >
          <option value="">Alle Status</option>
          {Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <button
          type="button"
          onClick={() => setTab("aktiv")}
          className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-[transform,background-color] active:scale-[0.97] touch-manipulation ${
            tab === "aktiv"
              ? "bg-[#0d5c63] text-white"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          Aktiv ({activeCount})
        </button>
        <button
          type="button"
          onClick={() => setTab("erledigt")}
          className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-[transform,background-color] active:scale-[0.97] touch-manipulation ${
            tab === "erledigt"
              ? "bg-[#0d5c63] text-white"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          Erledigt ({doneCount})
        </button>
      </div>

      {isLoading && visibleOrders.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Aufträge werden geladen…
        </div>
      )}

      {!isLoading && visibleOrders.length === 0 && (
        <Card className="!p-8 text-center text-sm text-slate-500">
          {tab === "erledigt" ? "Keine erledigten Aufträge." : "Keine aktiven Aufträge."}
        </Card>
      )}

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {visibleOrders.map((order) => {
          const overdue = isOverdue(order.scheduledStart, order.status);
          const today = !overdue && !isOrderDone(order.status) && isToday(order.scheduledStart);
          const currentPhase = getCurrentPhase(order.phases);
          const service = order.services.map((s) => orderServiceLabel(s)).filter(Boolean).join(", ");
          return (
            <button
              key={order.id}
              type="button"
              onClick={() => router.push(`/dashboard/auftraege/${order.id}`)}
              className="w-full text-left rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-[transform,background-color] active:scale-[0.99] active:bg-slate-50 touch-manipulation"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[#0d5c63]">{order.orderNumber}</p>
                  <p className="mt-0.5 text-sm font-medium text-slate-900 truncate">
                    {order.customer.firstName} {order.customer.lastName}
                  </p>
                  {order.title && (
                    <p className="text-xs text-slate-500 truncate mt-0.5">{order.title}</p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300 shrink-0 mt-0.5" />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {overdue && <Badge status="UEBERFAELLIG" label="Überfällig" />}
                {today && <Badge status="HEUTE" label="Heute" />}
                <Badge status={order.status} label={ORDER_STATUS_LABELS[order.status]} />
              </div>
              <div className="mt-2 space-y-0.5 text-xs text-slate-500">
                {service && <p className="truncate">{service}</p>}
                <p>
                  {order.property.zipCode} {order.property.city}
                  {order.scheduledStart ? ` · ${formatDateTime(order.scheduledStart)}` : ""}
                </p>
                {currentPhase && <p>Phase: {currentPhase.name}</p>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500 bg-slate-50/80">
                <th className="py-3 pl-4 pr-4 font-medium">Nr.</th>
                <th className="py-3 pr-4 font-medium">Kunde</th>
                <th className="py-3 pr-4 font-medium">Leistung</th>
                <th className="py-3 pr-4 font-medium">Ort</th>
                <th className="py-3 pr-4 font-medium">Phase</th>
                <th className="py-3 pr-4 font-medium">Termin</th>
                <th className="py-3 pr-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visibleOrders.map((order) => {
                const overdue = isOverdue(order.scheduledStart, order.status);
                const today =
                  !overdue && !isOrderDone(order.status) && isToday(order.scheduledStart);
                const currentPhase = getCurrentPhase(order.phases);
                return (
                  <tr
                    key={order.id}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/dashboard/auftraege/${order.id}`)}
                  >
                    <td className="py-3.5 pl-4 pr-4 font-medium text-[#0d5c63]">
                      {order.orderNumber}
                    </td>
                    <td className="py-3.5 pr-4">
                      {order.customer.firstName} {order.customer.lastName}
                    </td>
                    <td className="py-3.5 pr-4 text-slate-500">
                      {order.services.map((s) => orderServiceLabel(s)).join(", ")}
                    </td>
                    <td className="py-3.5 pr-4 text-slate-500">{order.property.city}</td>
                    <td className="py-3.5 pr-4">
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
                    <td className="py-3.5 pr-4 text-slate-500">
                      {order.scheduledStart ? formatDateTime(order.scheduledStart) : "–"}
                    </td>
                    <td className="py-3.5 pr-4">
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
        </div>
      </Card>
    </div>
  );
}
