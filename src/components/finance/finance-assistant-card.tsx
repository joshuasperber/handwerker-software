"use client";

import { ArrowRight, Check, CircleAlert, Sparkles, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FinanceAssistantInsight, PlannedInvestmentDTO } from "@/lib/finance/types";
import { cn, formatDate, formatEuro } from "@/lib/utils";

function Metric({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border px-3.5 py-3 backdrop-blur-sm",
        emphasized
          ? "border-white/25 bg-white/15"
          : "border-white/10 bg-white/[0.07]"
      )}
    >
      <p className="text-[11px] font-medium text-white/60">{label}</p>
      <p className="mt-1 truncate text-base font-semibold tabular-nums text-white sm:text-lg">
        {value}
      </p>
    </div>
  );
}

export function FinanceAssistantCard({
  insight,
  investments,
  revenueBasis,
  onOpenInvestment,
  onViewInvestments,
}: {
  insight: FinanceAssistantInsight;
  investments: PlannedInvestmentDTO[];
  revenueBasis: "ISSUE_DATE" | "PAYMENT_DATE";
  onOpenInvestment: (investment: PlannedInvestmentDTO) => void;
  onViewInvestments: () => void;
}) {
  const scenario = insight.investmentScenario;
  const investment = scenario
    ? investments.find((entry) => entry.id === scenario.investmentId) ?? null
    : null;
  const isReview = insight.state === "REVIEW";
  const paymentProjectionLabel =
    revenueBasis === "ISSUE_DATE"
      ? "Wenn alle offenen Rechnungen dieses Zeitraums eingehen"
      : "Wenn alle offenen Rechnungen eingehen";

  return (
    <section
      aria-labelledby="finance-assistant-title"
      className="relative isolate overflow-hidden rounded-[1.65rem] border border-[#0d5c63]/20 bg-[#073f46] p-4 text-white shadow-[0_24px_70px_-34px_rgba(6,78,87,0.75)] sm:p-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-24 -z-10 h-64 w-64 rounded-full bg-[#25a9a0]/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 left-1/3 -z-10 h-52 w-72 rounded-full bg-orange-400/15 blur-3xl"
      />

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/12 ring-1 ring-white/15">
              <Sparkles className="h-4.5 w-4.5 text-[#8be0d8]" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8be0d8]">
                Betriebs-Copilot
              </p>
              <p className="text-xs text-white/55">Finanzen vorausdenken, nicht nur ansehen</p>
            </div>
            <Badge
              className={cn(
                "ml-auto border-0 px-2.5 py-1 text-[11px] sm:ml-2",
                isReview
                  ? "bg-orange-300 text-orange-950 hover:bg-orange-300"
                  : "bg-emerald-200 text-emerald-950 hover:bg-emerald-200"
              )}
            >
              {insight.eyebrow}
            </Badge>
          </div>

          <h2 id="finance-assistant-title" className="mt-5 text-xl font-semibold leading-tight text-white sm:text-2xl">
            {insight.projectedAdditionalRevenue > 0
              ? `${paymentProjectionLabel}, liegt dein geschätzter Gewinn bei ${formatEuro(insight.projectedProfit)}.`
              : insight.headline}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">{insight.summary}</p>

          <div className="mt-5 grid grid-cols-2 gap-2 2xl:grid-cols-4">
            <Metric label="Gewinn aktuell" value={formatEuro(insight.currentProfit)} />
            <Metric
              label="Bei Zahlungseingang"
              value={formatEuro(insight.projectedProfit)}
              emphasized={insight.projectedAdditionalRevenue > 0}
            />
            <Metric label="Deine Prüfschwelle" value={formatEuro(insight.reviewThreshold)} />
            <Metric
              label="Über Orientierung"
              value={formatEuro(insight.amountAboveThreshold)}
              emphasized={insight.amountAboveThreshold > 0}
            />
          </div>
        </div>

        {scenario ? (
          <div className="w-full rounded-2xl border border-white/15 bg-white/[0.09] p-4 shadow-inner shadow-black/5 xl:max-w-md">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-200">
                  Bereits geplante Investition
                </p>
                <h3 className="mt-1 truncate text-base font-semibold text-white">{scenario.title}</h3>
                <p className="mt-1 text-xs text-white/55">
                  {scenario.categoryLabel} · {scenario.readinessLabel}
                  {scenario.plannedDate ? ` · ${formatDate(scenario.plannedDate)}` : ""}
                </p>
              </div>
              <div className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-right">
                <p className="text-[10px] text-white/50">Kaufpreis</p>
                <p className="font-semibold tabular-nums">{formatEuro(scenario.plannedAmount)}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-black/10 p-3">
                <p className="text-[10px] leading-4 text-white/55">Gewinn danach*</p>
                <p className="mt-0.5 font-semibold tabular-nums">
                  {formatEuro(scenario.projectedProfitAfterImmediateDeduction)}
                </p>
              </div>
              <div className="rounded-xl bg-black/10 p-3">
                <p className="text-[10px] leading-4 text-white/55">Steuer-Rechenwert*</p>
                <p className="mt-0.5 font-semibold tabular-nums text-[#8be0d8]">
                  − {formatEuro(scenario.modeledTaxDifference)}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {insight.nextSteps.map((step) => (
                <div key={step} className="flex items-start gap-2 text-xs leading-5 text-white/70">
                  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <Check className="h-2.5 w-2.5 text-[#8be0d8]" />
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>

            <Button
              type="button"
              className="mt-4 w-full justify-between bg-white text-[#073f46] hover:bg-white/90"
              onClick={() => investment && onOpenInvestment(investment)}
              disabled={!investment}
            >
              Investition prüfen
              <ArrowRight className="h-4 w-4" />
            </Button>
            <p className="mt-3 text-[10px] leading-4 text-white/45">
              * Vereinfachte Modellrechnung bei vollständigem Sofortabzug und deinem hinterlegten
              Steuersatz. Tatsächlich können Vorsteuer, Abschreibung, Rechtsform und private Nutzung
              die Wirkung verändern. Keine Steuer- oder Kaufberatung.
            </p>
          </div>
        ) : (
          <div className="w-full rounded-2xl border border-white/15 bg-white/[0.08] p-4 xl:max-w-sm">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                {insight.state === "ON_TRACK" ? (
                  <WalletCards className="h-4 w-4 text-[#8be0d8]" />
                ) : (
                  <CircleAlert className="h-4 w-4 text-orange-200" />
                )}
              </span>
              <div>
                <p className="font-medium text-white">
                  {insight.state === "ON_TRACK"
                    ? "Kein Kaufdruck"
                    : "Erst Bedarf planen, dann entscheiden"}
                </p>
                <p className="mt-1 text-xs leading-5 text-white/60">
                  {insight.nextSteps[0]}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-4 w-full justify-between border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
              onClick={onViewInvestments}
            >
              Investitionen öffnen
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-[11px] leading-4 text-white/55">
        <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-200" />
        <p>
          Die Prüfschwelle ist deine betriebliche Orientierung, keine gesetzliche Steuergrenze.
          Eine Investition senkt nicht den Umsatz; sie kann – abhängig von der steuerlichen
          Behandlung – den Gewinn beeinflussen.
        </p>
      </div>
    </section>
  );
}
