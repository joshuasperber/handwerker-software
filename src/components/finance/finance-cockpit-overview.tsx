"use client";

import { lazy, Suspense } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CanAccess } from "@/components/auth/can-access";
import { FinanceSection } from "@/components/finance/finance-section";
import { FinanceWarningsPanel } from "@/components/finance/warnings-panel";
import {
  FINANCE_DISCLAIMERS,
  REVENUE_BASIS_LABELS,
  type ExpenseDTO,
  type FinanceOverview,
  type PlannedInvestmentDTO,
} from "@/lib/finance/types";
import { cn, formatDate, formatEuro } from "@/lib/utils";
import {
  AlertTriangle,
  Calculator,
  FileWarning,
  Loader2,
  PiggyBank,
  Receipt,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const ExpenseCategoryChart = lazy(() =>
  import("@/components/finance/expense-category-chart").then((m) => ({
    default: m.ExpenseCategoryChart,
  }))
);

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
  onClick?: () => void;
}) {
  const content = (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className={`mt-1 text-xl font-bold sm:text-2xl ${accent ?? "text-slate-900"}`}>
          {value}
        </p>
        {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
      </div>
      <div className="rounded-lg bg-slate-100 p-2">
        <Icon className="h-4 w-4 text-[#0d5c63]" />
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-xl text-left transition hover:ring-2 hover:ring-[#0d5c63]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d5c63]"
      >
        <Card className="h-full !p-4 hover:bg-slate-50/80">{content}</Card>
      </button>
    );
  }

  return <Card className="!p-4">{content}</Card>;
}

export function FinanceCockpitOverview({
  overview,
  onOpenExpense,
  onOpenInvestment,
  onViewAusgaben,
  onViewInvestitionen,
}: {
  overview: FinanceOverview;
  onOpenExpense: (expense?: ExpenseDTO | null) => void;
  onOpenInvestment: (investment?: PlannedInvestmentDTO | null) => void;
  onViewAusgaben: () => void;
  onViewInvestitionen: () => void;
}) {
  const chartData = overview.expenses.byCategory.map((c) => ({
    name: c.label.length > 18 ? `${c.label.slice(0, 16)}…` : c.label,
    amount: c.amount,
  }));
  const investmentTotal = overview.plannedInvestments.reduce(
    (sum, inv) => sum + inv.plannedAmount,
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Kennzahlen
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard
            label="Umsatz netto"
            value={formatEuro(overview.revenue.net)}
            sub={`${overview.revenue.invoiceCount} Rechnungen · ${REVENUE_BASIS_LABELS[overview.revenue.basis]}`}
            icon={TrendingUp}
            accent="text-emerald-700"
          />
          <KpiCard
            label="Ausgaben netto"
            value={formatEuro(overview.expenses.net)}
            sub={`${overview.expenses.count} erfasst · ${overview.expenses.withReceipt} mit Beleg`}
            icon={TrendingDown}
            accent="text-rose-700"
            onClick={onViewAusgaben}
          />
          <KpiCard
            label="Geschätzter Gewinn"
            value={formatEuro(overview.profit.estimatedNet)}
            sub={overview.profit.formulaLabel}
            icon={Calculator}
          />
        </div>
      </div>

      <FinanceSection
        id="umsatz"
        title="Umsatz"
        defaultOpen
        preview={
          <span>
            Netto {formatEuro(overview.revenue.net)} · Brutto{" "}
            {formatEuro(overview.revenue.gross)}
          </span>
        }
      >
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-lg bg-emerald-50 p-3">
            <dt className="text-xs text-emerald-800">Netto</dt>
            <dd className="font-semibold text-emerald-900">{formatEuro(overview.revenue.net)}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">USt</dt>
            <dd className="font-semibold">{formatEuro(overview.revenue.vat)}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">Rechnungen im Zeitraum</dt>
            <dd className="font-semibold">{overview.revenue.invoiceCount}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-slate-500">
          Grundlage: {REVENUE_BASIS_LABELS[overview.revenue.basis]}
          {overview.revenue.includesUnpaid ? " · inkl. unbezahlter Rechnungen" : ""}
        </p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link href="/dashboard/umsatz">Zur Umsatzübersicht</Link>
        </Button>
      </FinanceSection>

      <FinanceSection
        id="ausgaben"
        title="Ausgaben"
        preview={
          <span>
            {formatEuro(overview.expenses.net)} netto · {overview.expenses.count} Positionen
          </span>
        }
      >
        {chartData.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">
            Noch keine Ausgaben im gewählten Zeitraum.
          </p>
        ) : (
          <div className="hidden lg:block">
            <Suspense
              fallback={
                <div className="flex h-48 items-center justify-center text-sm text-slate-400">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Diagramm wird geladen…
                </div>
              }
            >
              <ExpenseCategoryChart data={chartData} />
            </Suspense>
          </div>
        )}
        <ul className="mt-2 space-y-1.5 text-sm lg:mt-3">
          {overview.expenses.byCategory.map((c) => (
            <li key={c.category} className="flex justify-between gap-2">
              <span className="text-slate-600">{c.label}</span>
              <span className="font-medium">{formatEuro(c.amount)}</span>
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onViewAusgaben}>
          Alle Ausgaben
        </Button>
      </FinanceSection>

      <FinanceSection
        id="gewinn"
        title="Gewinn"
        defaultOpen
        preview={<span>Schätzung {formatEuro(overview.profit.estimatedNet)}</span>}
      >
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-lg bg-emerald-50 p-3">
            <p className="text-xs text-emerald-800">Umsatz netto</p>
            <p className="font-semibold text-emerald-900">{formatEuro(overview.revenue.net)}</p>
          </div>
          <div className="rounded-lg bg-rose-50 p-3">
            <p className="text-xs text-rose-800">− Ausgaben netto</p>
            <p className="font-semibold text-rose-900">{formatEuro(overview.expenses.net)}</p>
          </div>
          <div className="rounded-lg bg-slate-100 p-3">
            <p className="text-xs text-slate-600">= Geschätzter Gewinn</p>
            <p className="font-semibold text-slate-900">
              {formatEuro(overview.profit.estimatedNet)}
            </p>
          </div>
        </div>
        {overview.profit.targetNet != null && overview.profit.targetNet > 0 && (
          <div className="mt-3">
            <p className="text-xs text-slate-500">
              Orientierungsziel {formatEuro(overview.profit.targetNet)}
            </p>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#0d5c63]"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(0, (overview.profit.estimatedNet / overview.profit.targetNet) * 100)
                  )}%`,
                }}
              />
            </div>
          </div>
        )}
        <p className="mt-2 text-[11px] text-slate-500">{FINANCE_DISCLAIMERS.taxEstimate}</p>
      </FinanceSection>

      <div className="grid gap-4 lg:grid-cols-2">
        <FinanceSection
          id="steuer"
          title="Steuerliche Orientierung"
          preview={
            <span>
              {formatEuro(overview.tax.estimatedAmount)} bei {overview.tax.estimatedRate} %
            </span>
          }
        >
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-amber-50 p-2">
              <Receipt className="h-4 w-4 text-amber-700" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">
                {formatEuro(overview.tax.estimatedAmount)}
              </p>
              <p className="text-xs text-slate-500">
                Unverbindliche Schätzung mit {overview.tax.estimatedRate} % auf den geschätzten
                Gewinn. Keine Steuerfestsetzung.
              </p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">{FINANCE_DISCLAIMERS.overview}</p>
        </FinanceSection>

        <FinanceSection
          id="ruecklagen"
          title="Rücklagen"
          preview={<span>{formatEuro(overview.tax.recommendedReserve)}</span>}
        >
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-slate-100 p-2">
              <Target className="h-4 w-4 text-[#0d5c63]" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">
                {formatEuro(overview.tax.recommendedReserve)}
              </p>
              <p className="text-xs text-slate-500">
                Orientierung: {overview.tax.reservePercentUsed} % vom geschätzten Gewinn zur Seite
                legen. Keine Empfehlung für ein konkretes Konto oder Modell.
              </p>
            </div>
          </div>
        </FinanceSection>
      </div>

      <FinanceSection
        id="rechnungen"
        title="Offene Rechnungen"
        preview={
          <span>
            {overview.invoices.openCount} offen · {formatEuro(overview.invoices.openSum)}
            {overview.invoices.overdueCount > 0 &&
              ` · ${overview.invoices.overdueCount} überfällig`}
          </span>
        }
      >
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Offen</span>
            <span className="font-medium">
              {overview.invoices.openCount} · {formatEuro(overview.invoices.openSum)}
            </span>
          </div>
          <div className={cn("flex justify-between", overview.invoices.overdueCount > 0 && "text-amber-700")}>
            <span className="flex items-center gap-1">
              {overview.invoices.overdueCount > 0 && <AlertTriangle className="h-3.5 w-3.5" />}
              Überfällig
            </span>
            <span className="font-medium">
              {overview.invoices.overdueCount} · {formatEuro(overview.invoices.overdueSum)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Bezahlt (Zeitraum)</span>
            <span>
              {overview.invoices.paidCount} · {formatEuro(overview.invoices.paidSum)}
            </span>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link href="/dashboard/rechnungen">Zur Rechnungsübersicht</Link>
        </Button>
      </FinanceSection>

      <FinanceSection
        id="belege"
        title="Belege"
        preview={
          <span>
            {overview.expenses.withReceipt} von {overview.expenses.count} Ausgaben mit Beleg
            {overview.expenses.withoutReceipt > 0 &&
              ` · ${overview.expenses.withoutReceipt} fehlen`}
          </span>
        }
      >
        {overview.expenses.withoutReceipt > 0 && (
          <Badge variant="outline" className="mb-2 gap-1 border-amber-300 text-amber-800">
            <FileWarning className="h-3 w-3" />
            {overview.expenses.withoutReceipt} ohne Beleg
          </Badge>
        )}
        {overview.recentExpenses.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">Noch keine Ausgaben erfasst.</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                    <th className="py-2 pr-3 font-medium">Datum</th>
                    <th className="py-2 pr-3 font-medium">Beschreibung</th>
                    <th className="py-2 pr-3 text-right font-medium">Netto</th>
                    <th className="py-2 font-medium">Beleg</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recentExpenses.slice(0, 6).map((e) => (
                    <tr
                      key={e.id}
                      className="cursor-pointer border-b border-slate-50 hover:bg-slate-50/50"
                      onClick={() => onOpenExpense(e)}
                    >
                      <td className="whitespace-nowrap py-2 pr-3">{formatDate(e.expenseDate)}</td>
                      <td className="max-w-[180px] truncate py-2 pr-3">{e.description}</td>
                      <td className="py-2 pr-3 text-right font-medium">{formatEuro(e.netAmount)}</td>
                      <td className="py-2">
                        {e.hasReceipt ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                            Vorhanden
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-300 text-amber-800">
                            Fehlt
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-slate-50 md:hidden">
              {overview.recentExpenses.slice(0, 5).map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className="w-full py-3 text-left"
                  onClick={() => onOpenExpense(e)}
                >
                  <div className="flex justify-between gap-2">
                    <p className="text-sm font-medium">{e.description}</p>
                    <p className="shrink-0 text-sm font-semibold">{formatEuro(e.netAmount)}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatDate(e.expenseDate)} · {e.hasReceipt ? "Beleg vorhanden" : "Beleg fehlt"}
                  </p>
                </button>
              ))}
            </div>
          </>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onViewAusgaben}>
            Alle Belege
          </Button>
          <CanAccess permission="invoices.write">
            <Button type="button" size="sm" variant="outline" onClick={() => onOpenExpense(null)}>
              Ausgabe erfassen
            </Button>
          </CanAccess>
        </div>
      </FinanceSection>

      <FinanceSection
        id="investitionen"
        title="Investitionen"
        defaultOpen
        preview={
          <span>
            {overview.plannedInvestments.length} geplant / verschoben ·{" "}
            {formatEuro(investmentTotal)}
          </span>
        }
      >
        <p className="mb-3 text-sm text-slate-600">{FINANCE_DISCLAIMERS.whenToInvest}</p>
        {overview.profit.estimatedNet >
          (overview.settings.highProfitWarningThreshold ?? 5000) && (
          <p className="mb-3 text-sm text-slate-600">{FINANCE_DISCLAIMERS.highProfit}</p>
        )}
        {overview.plannedInvestments.length === 0 ? (
          <p className="py-3 text-sm text-slate-500">Noch keine geplanten Investitionen.</p>
        ) : (
          <ul className="space-y-2">
            {overview.plannedInvestments.slice(0, 5).map((inv) => (
              <li key={inv.id}>
                <button
                  type="button"
                  onClick={() => onOpenInvestment(inv)}
                  className="w-full rounded-lg border border-slate-100 p-3 text-left hover:bg-slate-50"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-slate-800">{inv.title}</p>
                      <p className="text-xs text-slate-500">
                        {inv.categoryLabel}
                        {inv.plannedDate ? ` · ${formatDate(inv.plannedDate)}` : " · kein Zeitpunkt"}
                        {inv.machineName ? ` · Maschine: ${inv.machineName}` : ""}
                        {inv.articleName ? ` · Material: ${inv.articleName}` : ""}
                        {inv.projectName ? ` · Projekt: ${inv.projectName}` : ""}
                      </p>
                      {inv.note && <p className="mt-1 text-xs text-slate-500">{inv.note}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{formatEuro(inv.plannedAmount)}</span>
                      <Badge variant="outline">{inv.statusLabel}</Badge>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onViewInvestitionen}>
            Alle Investitionen
          </Button>
          <CanAccess permission="invoices.write">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => onOpenInvestment(null)}
            >
              <PiggyBank className="h-3.5 w-3.5" />
              Investition planen
            </Button>
          </CanAccess>
        </div>
        <p className="mt-3 text-[11px] text-slate-400">{FINANCE_DISCLAIMERS.investment}</p>
      </FinanceSection>

      <section id="hinweise">
        <FinanceWarningsPanel warnings={overview.warnings} />
      </section>
    </div>
  );
}
