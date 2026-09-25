"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { formatEuro } from "@/lib/utils";
import type { ProjectFinanceResult } from "@/lib/projects/finance";

type Payload = ProjectFinanceResult & { project: { id: string; name: string; status: string } };

function money(n: number) {
  return formatEuro(n);
}

function Kpis({ data }: { data: Payload }) {
  const items = [
    ["Umsatz", money(data.revenueNet)],
    ["Kosten", money(data.costTotal)],
    ["Ergebnis", money(data.profit)],
    ["Offene Rechnung", money(data.openInvoiceGross)],
  ];
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-slate-100 p-3">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-lg font-semibold text-slate-900">{value}</p>
        </div>
      ))}
    </div>
  );
}

function Details({ data }: { data: Payload }) {
  const rows: [string, number, number, number][] = [
    ["Material", data.planned.material, data.costs.material, data.variance.material],
    ["Mitarbeiter", data.planned.labor, data.costs.labor, data.variance.labor],
    ["Maschinen", data.planned.machines, data.costs.machines, data.variance.machines],
    ["Fahrt", data.planned.travel, data.costs.travel, data.variance.travel],
    ["Sonstige", data.planned.other, data.costs.other, data.variance.other],
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Umsatz netto {money(data.revenueNet)} · brutto {money(data.revenueGross)}. Bezahlt{" "}
        {money(data.paidInvoiceGross)}. Noch nicht abgerechnet {money(data.unbilledNet)}.
        {data.marginPercent != null ? ` Marge ${data.marginPercent} %.` : ""}
        {data.plannedMarginPercent != null
          ? ` Geplante Marge ${data.plannedMarginPercent} %.`
          : ""}
      </p>
      {data.doubleBillingWarning && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {data.doubleBillingWarning}
        </p>
      )}
      {data.incomplete.map((note) => (
        <p key={note} className="text-sm text-slate-600">
          {note}
        </p>
      ))}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-2">Kosten</th>
              <th className="py-2 text-right">Geplant</th>
              <th className="py-2 text-right">Tatsächlich</th>
              <th className="py-2 text-right">Abweichung</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, plan, actual, delta]) => (
              <tr key={label} className="border-t border-slate-100">
                <td className="py-2">{label}</td>
                <td className="py-2 text-right">{money(plan)}</td>
                <td className="py-2 text-right">{money(actual)}</td>
                <td className="py-2 text-right">{money(delta)}</td>
              </tr>
            ))}
            <tr className="border-t border-slate-200 font-medium">
              <td className="py-2">Ergebnis</td>
              <td className="py-2 text-right">{money(data.plannedProfit)}</td>
              <td className="py-2 text-right">{money(data.profit)}</td>
              <td className="py-2 text-right">{money(data.variance.profit)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-2">Auftrag</th>
              <th className="py-2 text-right">Umsatz</th>
              <th className="py-2 text-right">Kosten</th>
              <th className="py-2 text-right">Ergebnis</th>
            </tr>
          </thead>
          <tbody>
            {data.orders.map((order) => (
              <tr key={order.id} className="border-t border-slate-100">
                <td className="py-2">
                  <Link href={`/dashboard/auftraege/${order.id}`} className="text-[#0d5c63] hover:underline">
                    {order.orderNumber}
                    {order.title ? ` · ${order.title}` : ""}
                  </Link>
                  {order.inClosingInvoice && (
                    <span className="ml-2 text-xs text-slate-500">in Abschlussrechnung</span>
                  )}
                </td>
                <td className="py-2 text-right">{money(order.revenueNet)}</td>
                <td className="py-2 text-right">{money(order.costTotal)}</td>
                <td className="py-2 text-right">{money(order.profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.laborLines.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">Stundenzettel</p>
          <ul className="space-y-1 text-sm text-slate-700">
            {data.laborLines.map((line) => (
              <li key={line.orderNumber}>
                {line.orderNumber}: {line.hours} Std.
                {line.missingWage ? " · Stundenlohn fehlt" : ` · ${money(line.cost ?? 0)}`}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-slate-500">
        Abschlussrechnung: {data.closingInvoiceNumbers.join(", ") || "keine"}. Einzelrechnungen:{" "}
        {data.orderInvoiceNumbers.join(", ") || "keine"}.
        {data.missingReceipts > 0 ? ` Fehlende Belege: ${data.missingReceipts}.` : ""}
      </p>
      <p className="text-[11px] text-slate-400">
        Geschätzte Auswertung aus Rechnungen, Ausgaben, Stundenzetteln und Kalkulation. Keine
        steuerliche Bewertung.
      </p>
    </div>
  );
}

export function ProjectFinancePanel({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await fetch(`/api/projects/${projectId}/finance`);
      const json = await res.json();
      if (!active) return;
      if (!json.success) {
        setError(json.error ?? "Finanzübersicht nicht verfügbar");
        return;
      }
      setData(json.data);
    })();
    return () => {
      active = false;
    };
  }, [projectId]);

  if (error) return <Card className="!p-4 text-sm text-rose-700">{error}</Card>;
  if (!data) return <Card className="!p-4 text-sm text-slate-500">Finanzen werden geladen…</Card>;

  return (
    <Card className="!p-4 space-y-4">
      <h2 className="text-sm font-semibold text-slate-900">Finanzen · {data.project.name}</h2>
      <Kpis data={data} />
      <details className="md:hidden">
        <summary className="cursor-pointer text-sm text-[#0d5c63]">Projektfinanzen</summary>
        <div className="mt-3">
          <Details data={data} />
        </div>
      </details>
      <div className="hidden md:block">
        <Details data={data} />
      </div>
    </Card>
  );
}

export function ProjectFinanceSummary({
  projectId,
  onOpen,
}: {
  projectId: string;
  onOpen: () => void;
}) {
  const [data, setData] = useState<Payload | null>(null);
  useEffect(() => {
    let active = true;
    void fetch(`/api/projects/${projectId}/finance`)
      .then((r) => r.json())
      .then((json) => {
        if (active && json.success) setData(json.data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [projectId]);
  if (!data) return null;
  return (
    <button type="button" onClick={onOpen} className="w-full rounded-xl border border-slate-200 p-4 text-left">
      <p className="text-sm font-semibold">Finanzen</p>
      <p className="mt-1 text-sm text-slate-600">
        Umsatz {money(data.revenueNet)} · Kosten {money(data.costTotal)} · Ergebnis {money(data.profit)} · offen{" "}
        {money(data.openInvoiceGross)}
      </p>
    </button>
  );
}
