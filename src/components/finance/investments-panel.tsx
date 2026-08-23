"use client";

import { useCallback, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/auth/can-access";
import { InvestmentFormDialog } from "@/components/finance/investment-form-dialog";
import { FinanceDisclaimer } from "@/components/finance/finance-disclaimer";
import { FINANCE_DISCLAIMERS, type PlannedInvestmentDTO } from "@/lib/finance/types";
import { swrKeys, useApiSWR } from "@/lib/swr";
import { formatDate, formatEuro } from "@/lib/utils";
import { ArrowLeft, Loader2, PiggyBank, Plus } from "lucide-react";

function investmentMeta(inv: PlannedInvestmentDTO) {
  return [
    inv.categoryLabel,
    inv.plannedDate ? formatDate(inv.plannedDate) : "Kein Zeitpunkt",
    inv.machineName ? `Maschine: ${inv.machineName}` : null,
    inv.articleName ? `Material: ${inv.articleName}` : null,
    inv.projectName ? `Projekt: ${inv.projectName}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function InvestmentsPanel({
  onBack,
  onChanged,
}: {
  onBack?: () => void;
  onChanged?: () => void;
}) {
  const [investmentOpen, setInvestmentOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<PlannedInvestmentDTO | null>(
    null
  );

  const {
    data: investments,
    error: swrError,
    isLoading,
    isValidating,
    mutate,
  } = useApiSWR<PlannedInvestmentDTO[]>(swrKeys.financeInvestments(), {
    dedupingInterval: 3_000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  const loading = isLoading && !investments;
  const error = swrError
    ? swrError instanceof Error
      ? swrError.message
      : "Daten konnten nicht geladen werden"
    : null;

  const refresh = useCallback(async () => {
    await mutate();
    onChanged?.();
  }, [mutate, onChanged]);

  const openCreate = () => {
    setEditingInvestment(null);
    setInvestmentOpen(true);
  };

  const openEdit = (inv: PlannedInvestmentDTO) => {
    setEditingInvestment(inv);
    setInvestmentOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {onBack && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mb-2 -ml-2 gap-1.5 text-slate-600"
              onClick={onBack}
            >
              <ArrowLeft className="h-4 w-4" />
              Zurück zur Finanzübersicht
            </Button>
          )}
          <div className="flex items-center gap-2">
            <PiggyBank className="h-7 w-7 text-[#0d5c63]" />
            <h1 className="text-2xl font-bold text-slate-900">Investitionen</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            {FINANCE_DISCLAIMERS.whenToInvest}
            {isValidating && investments && (
              <span className="ml-2 inline-flex items-center gap-1 text-slate-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                aktualisiert…
              </span>
            )}
          </p>
        </div>
        <CanAccess permission="invoices.write">
          <Button onClick={openCreate} className="w-full gap-2 sm:w-auto">
            <Plus className="h-4 w-4" />
            Investition planen
          </Button>
        </CanAccess>
      </div>

      <FinanceDisclaimer compact />

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Investitionen werden geladen…
        </div>
      )}

      {error && !loading && !investments && (
        <Card className="border-rose-200 bg-rose-50 !p-4 text-rose-800">{error}</Card>
      )}

      {investments && (
        <Card className="!p-0 overflow-hidden">
          {investments.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Noch keine geplanten Investitionen.{" "}
              <CanAccess permission="invoices.write">
                <button
                  type="button"
                  className="text-[#0d5c63] underline"
                  onClick={openCreate}
                >
                  Erste Investition planen
                </button>
              </CanAccess>
            </p>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                      <th className="px-4 py-2 font-medium">Investition</th>
                      <th className="px-4 py-2 font-medium">Kategorie</th>
                      <th className="px-4 py-2 font-medium text-right">Betrag</th>
                      <th className="px-4 py-2 font-medium">Zeitpunkt</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Bezug</th>
                    </tr>
                  </thead>
                  <tbody>
                    {investments.map((inv) => (
                      <tr
                        key={inv.id}
                        className="cursor-pointer border-b border-slate-50 hover:bg-slate-50/50"
                        onClick={() => openEdit(inv)}
                      >
                        <td className="px-4 py-2">
                          <p className="font-medium text-slate-800">{inv.title}</p>
                          {inv.note && (
                            <p className="text-xs text-slate-500 line-clamp-1">{inv.note}</p>
                          )}
                        </td>
                        <td className="px-4 py-2">{inv.categoryLabel}</td>
                        <td className="px-4 py-2 text-right font-semibold">
                          {formatEuro(inv.plannedAmount)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {inv.plannedDate ? formatDate(inv.plannedDate) : "—"}
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="outline">{inv.statusLabel}</Badge>
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-500">
                          {[inv.machineName, inv.articleName, inv.projectName]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-slate-50 md:hidden">
                {investments.map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => openEdit(inv)}
                    className="w-full p-4 text-left hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-slate-800">{inv.title}</p>
                      <span className="shrink-0 font-semibold">
                        {formatEuro(inv.plannedAmount)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{investmentMeta(inv)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{inv.statusLabel}</Badge>
                      {inv.note && (
                        <span className="text-xs text-slate-500 line-clamp-2">{inv.note}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-400">
            {FINANCE_DISCLAIMERS.plannedInvestments} {FINANCE_DISCLAIMERS.overview}
          </p>
        </Card>
      )}

      <InvestmentFormDialog
        open={investmentOpen}
        onOpenChange={(open) => {
          setInvestmentOpen(open);
          if (!open) setEditingInvestment(null);
        }}
        onSaved={refresh}
        investment={editingInvestment}
      />
    </div>
  );
}
