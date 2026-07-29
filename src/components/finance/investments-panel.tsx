"use client";

import { useCallback, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/auth/can-access";
import { InvestmentFormDialog } from "@/components/finance/investment-form-dialog";
import { FINANCE_DISCLAIMERS, type PlannedInvestmentDTO } from "@/lib/finance/types";
import { swrKeys, useApiSWR } from "@/lib/swr";
import { formatDate, formatEuro } from "@/lib/utils";
import { ArrowLeft, Loader2, PiggyBank, Plus } from "lucide-react";

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
          <p className="mt-1 text-sm text-slate-500">
            Geplante Investitionen
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
        <Card className="!p-4">
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
            <div className="space-y-2">
              {investments.map((inv) => (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => openEdit(inv)}
                  className="w-full flex flex-col gap-1 rounded-lg border border-slate-100 p-3 text-left hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-slate-800">{inv.title}</p>
                    <p className="text-xs text-slate-500">
                      {inv.categoryLabel}
                      {inv.plannedDate && ` · ${formatDate(inv.plannedDate)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">
                      {formatEuro(inv.plannedAmount)}
                    </span>
                    <Badge variant="outline">{inv.statusLabel}</Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
          <p className="text-[11px] text-slate-400 mt-3">
            {FINANCE_DISCLAIMERS.plannedInvestments}
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
