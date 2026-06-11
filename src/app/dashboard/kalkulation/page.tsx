"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatEuro, formatDateTime } from "@/lib/utils";
import { CanAccess } from "@/components/auth/can-access";
import { AddButton } from "@/components/ui/add-button";
import { InfoButton } from "@/components/ui/info-button";
import { saveJson } from "@/lib/save-toast";
import { Calculator } from "lucide-react";

interface CalcRow {
  id: string;
  title: string | null;
  status: string;
  netSalesPrice: number;
  grossSalesPrice: number;
  marginPercent: number;
  profitabilityStatus: string;
  updatedAt: string;
  customer: { firstName: string; lastName: string } | null;
}

export default function KalkulationListPage() {
  const [items, setItems] = useState<CalcRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/calculations")
      .then((r) => r.json())
      .then((d) => { if (d.success) setItems(d.data); })
      .finally(() => setLoading(false));
  }, []);

  async function createNew() {
    const data = await saveJson<{ id: string }>(
      "/api/calculations",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Neue Kalkulation" }),
      },
      { loading: "Kalkulation wird angelegt …", success: "Kalkulation angelegt" }
    );
    if (data.success && data.data) {
      window.location.href = `/dashboard/kalkulation/${data.data.id}`;
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calculator className="h-7 w-7 text-[#0d5c63]" />
            Angebots- &amp; Rechnungskalkulation
            <InfoButton title="Wie funktioniert die Kalkulation?">
              <p>
                Die Kalkulation berechnet sich aus Materialkosten, Arbeitszeit, Zuschlägen und
                sonstigen Leistungen. Prüfen Sie die Werte sorgfältig, bevor ein Angebot erstellt
                wird.
              </p>
              <p>Leere Entwürfe ohne Positionen erscheinen nicht in der Liste.</p>
            </InfoButton>
          </h1>
        </div>
        <CanAccess permission="calculations.write">
          <AddButton onClick={createNew}>Neue Kalkulation</AddButton>
        </CanAccess>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card className="!p-4">
          <p className="text-sm text-slate-500">Enthält intern</p>
          <p className="text-sm mt-1">Gemeinkosten · Wagnis · Gewinn · ESt-Bedarf</p>
        </Card>
        <Card className="!p-4">
          <p className="text-sm text-slate-500">Sichtbar für Kunden</p>
          <p className="text-sm mt-1">Arbeit · Material · Fahrt · optional Maschine</p>
        </Card>
        <Card className="!p-4">
          <CanAccess permission="calculations.settings">
            <Link href="/dashboard/kalkulation/einstellungen" className="text-sm text-[#0d5c63] font-medium hover:underline">
              Unternehmensprofil & Fixkosten einrichten →
            </Link>
          </CanAccess>
        </Card>
      </div>

      <Card>
        {loading ? (
          <p className="text-slate-500 py-8 text-center">Laden...</p>
        ) : items.length === 0 ? (
          <p className="text-slate-500 py-8 text-center">Noch keine Kalkulationen. Starten Sie mit „Neue Kalkulation“.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {items.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/kalkulation/${c.id}`}
                className="flex items-center justify-between py-4 hover:bg-slate-50 -mx-2 px-2 rounded-lg"
              >
                <div>
                  <p className="font-medium text-[#0d5c63]">{c.title ?? "Ohne Titel"}</p>
                  <p className="text-sm text-slate-500">
                    {c.customer ? `${c.customer.firstName} ${c.customer.lastName}` : "Kein Kunde"} · {formatDateTime(c.updatedAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatEuro(c.grossSalesPrice)}</p>
                  <p className="text-xs text-slate-400">Netto {formatEuro(c.netSalesPrice)} · Marge {c.marginPercent?.toFixed(1)} %</p>
                  <Badge
                    status={c.profitabilityStatus}
                    label={c.profitabilityStatus === "profitable" ? "Profitabel" : c.profitabilityStatus === "tight" ? "Knapp" : "Warnung"}
                    className="mt-1"
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
