"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatEuro, formatDateTime } from "@/lib/utils";
import { CanAccess } from "@/components/auth/can-access";
import { AddButton } from "@/components/ui/add-button";
import { InfoButton } from "@/components/ui/info-button";
import { Calculator, Building2 } from "lucide-react";
import { NavActionCard } from "@/components/ui/nav-action-card";
import { CreateCalculationDialog } from "@/components/calculation/create-calculation-dialog";

interface CalcRow {
  id: string;
  title: string | null;
  status: string;
  netSalesPrice: number;
  grossSalesPrice: number;
  marginPercent: number;
  profitabilityStatus: string;
  updatedAt: string;
  useFixedPrice?: boolean;
  fixedPriceNet?: number | null;
  customer: {
    firstName: string;
    lastName: string;
    company?: string | null;
    customerType?: string;
  } | null;
}

export default function KalkulationListPage() {
  const [items, setItems] = useState<CalcRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    fetch("/api/calculations")
      .then((r) => r.json())
      .then((d) => { if (d.success) setItems(d.data); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calculator className="h-7 w-7 text-[#0d5c63]" />
            Angebots- &amp; Rechnungskalkulation
            <InfoButton title="Wie funktioniert die Kalkulation?">
              <p>
                Die Detailkalkulation berechnet Material, Arbeitszeit und Zuschläge.
                Alternativ legen Sie direkt einen Festpreis an — dann erscheint auf der
                Rechnung nur diese eine Position.
              </p>
              <p>
                Bei Business-Kunden mit USt-IdNr. schlägt die App Reverse-Charge vor
                (0 % USt auf der Rechnung, nach Bestätigung).
              </p>
            </InfoButton>
          </h1>
        </div>
        <CanAccess permission="calculations.write">
          <AddButton onClick={() => setCreateOpen(true)}>Neue Kalkulation</AddButton>
        </CanAccess>
      </div>

      <div className="mb-6">
        <CanAccess permission="calculations.settings">
          <NavActionCard
            href="/dashboard/kalkulation/einstellungen"
            title="Unternehmensprofil & Fixkosten"
            description="Adresse, Zuschläge und Gemeinkosten einrichten"
            icon={Building2}
          />
        </CanAccess>
      </div>

      <Card>
        {loading ? (
          <p className="text-slate-500 py-8 text-center">Laden...</p>
        ) : items.length === 0 ? (
          <p className="text-slate-500 py-8 text-center">
            Noch keine Kalkulationen. Starten Sie mit „Neue Kalkulation“ — Detail oder Festpreis.
          </p>
        ) : (
          <div className="divide-y divide-slate-50">
            {items.map((c) => {
              const displayNet =
                c.useFixedPrice && c.fixedPriceNet != null
                  ? c.fixedPriceNet
                  : c.netSalesPrice;
              const customerLabel = c.customer
                ? c.customer.customerType === "GEWERBLICH" && c.customer.company?.trim()
                  ? c.customer.company
                  : `${c.customer.firstName} ${c.customer.lastName}`
                : "Ohne Kunde";
              return (
                <Link
                  key={c.id}
                  href={`/dashboard/kalkulation/${c.id}${c.useFixedPrice ? "?step=10" : ""}`}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-4 px-2 -mx-2 rounded-xl hover:bg-slate-50 active:bg-slate-100 active:scale-[0.99] transition-[transform,background-color] touch-manipulation"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-[#0d5c63] flex flex-wrap items-center gap-2">
                      {c.title ?? "Ohne Titel"}
                      {c.useFixedPrice && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800">
                          Festpreis
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-slate-500">{customerLabel}</p>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <p className="font-semibold">{formatEuro(displayNet)} <span className="text-xs font-normal text-slate-400">netto</span></p>
                    <p className="text-xs text-slate-400">{formatDateTime(c.updatedAt)}</p>
                    {!c.useFixedPrice && (
                      <Badge
                        status={c.profitabilityStatus}
                        label={
                          c.profitabilityStatus === "profitable"
                            ? "Profitabel"
                            : c.profitabilityStatus === "tight"
                              ? "Knapp"
                              : "Warnung"
                        }
                        className="mt-1"
                      />
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      <CreateCalculationDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
