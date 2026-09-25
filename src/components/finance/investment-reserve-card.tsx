"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CanAccess } from "@/components/auth/can-access";
import { FINANCE_DISCLAIMERS, type InvestmentReserveProposalDTO } from "@/lib/finance/types";
import { swrKeys, useApiSWR } from "@/lib/swr";
import { saveJson } from "@/lib/save-toast";
import { formatEuro } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const STATUS_LABEL = {
  OPEN: "Offen",
  CONFIRMED: "Zurückgelegt",
  ADJUSTED: "Angepasst",
  DEFERRED: "Verschoben",
  IGNORED: "Ignoriert",
} as const;

export function InvestmentReserveCard({ onChanged }: { onChanged?: () => void }) {
  const { data, isLoading, mutate } = useApiSWR<InvestmentReserveProposalDTO>(
    swrKeys.financeInvestmentReserve(),
    { revalidateOnFocus: true }
  );
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (
    investmentId: string,
    action: "confirm" | "adjust" | "defer" | "ignore",
    applied?: number
  ) => {
    if (!data) return;
    setBusy(investmentId + action);
    const result = await saveJson(
      "/api/finance/investments/reserve",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: data.year,
          month: data.month,
          decisions: [{ investmentId, action, amount: applied }],
        }),
      },
      { success: "Rücklage vermerkt. Es wurde kein Geld überwiesen." }
    );
    setBusy(null);
    if (result?.success) {
      setAdjusting(null);
      await mutate();
      onChanged?.();
    }
  };

  if (isLoading && !data) {
    return (
      <Card className="flex items-center gap-2 !p-4 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Monatsvorschlag wird berechnet…
      </Card>
    );
  }
  if (!data || data.lines.length === 0) return null;

  return (
    <Card className="!p-4">
      <p className="text-sm font-semibold text-slate-900">
        Für {data.label} wurden folgende Investitionsrücklagen berechnet
      </p>
      <ul className="mt-3 space-y-3">
        {data.lines.map((line) => (
          <li key={line.investmentId} className="rounded-lg border border-slate-100 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-slate-800">{line.title}</p>
                <p className="mt-1 text-xs text-slate-500">{line.explanation}</p>
                {line.calculationBasisLabel && (
                  <p className="mt-1 text-xs text-slate-500">
                    Berechnungsbasis: {line.calculationBasisLabel}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold">{formatEuro(line.suggestedAmount)}</p>
                <p className="text-[11px] text-slate-400">{STATUS_LABEL[line.status]}</p>
              </div>
            </div>
            {line.status === "OPEN" && (
              <CanAccess permission="invoices.write">
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => act(line.investmentId, "confirm")}
                  >
                    Als zurückgelegt bestätigen
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAdjusting(line.investmentId);
                      setAmount(String(line.suggestedAmount));
                    }}
                  >
                    Betrag anpassen
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => act(line.investmentId, "defer")}
                  >
                    Auf nächsten Monat verschieben
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy !== null}
                    onClick={() => act(line.investmentId, "ignore")}
                  >
                    Ignorieren
                  </Button>
                </div>
                {adjusting === line.investmentId && (
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <Input
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      aria-label={`Angepasster Betrag für ${line.title}`}
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => {
                        const value = parseFloat(amount.replace(",", "."));
                        if (Number.isNaN(value) || value < 0) return;
                        void act(line.investmentId, "adjust", value);
                      }}
                    >
                      Angepassten Betrag speichern
                    </Button>
                  </div>
                )}
              </CanAccess>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm font-medium text-slate-800">
        Vorgeschlagene Rücklage gesamt: {formatEuro(data.totalSuggested)}
      </p>
      {data.percentWarning && <p className="mt-2 text-sm text-amber-800">{data.percentWarning}</p>}
      {data.warning && <p className="mt-2 text-sm text-amber-800">{data.warning}</p>}
      {data.revenueHint && <p className="mt-2 text-sm text-slate-600">{data.revenueHint}</p>}
      <p className="mt-3 text-[11px] text-slate-400">{FINANCE_DISCLAIMERS.reserveVirtual}</p>
    </Card>
  );
}
