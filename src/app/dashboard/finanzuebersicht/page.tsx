"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InfoButton } from "@/components/ui/info-button";
import { CanAccess } from "@/components/auth/can-access";
import { FinanceDisclaimer } from "@/components/finance/finance-disclaimer";
import { FinanceWarningsPanel } from "@/components/finance/warnings-panel";
import { ExpenseFormDialog } from "@/components/finance/expense-form-dialog";
import { InvestmentFormDialog } from "@/components/finance/investment-form-dialog";
import { fetchJson } from "@/lib/fetch-json";
import { saveJson } from "@/lib/save-toast";
import { formatEuro, formatDate } from "@/lib/utils";
import {
  FINANCE_DISCLAIMERS,
  REVENUE_BASIS_LABELS,
  type ExpenseDTO,
  type FinanceOverview,
  type FinancePeriodPreset,
  type PlannedInvestmentDTO,
} from "@/lib/finance/types";
import {
  TrendingUp,
  TrendingDown,
  Calculator,
  Receipt,
  AlertTriangle,
  Plus,
  FileWarning,
  Settings2,
  PiggyBank,
  Loader2,
  Target,
} from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  FINANCE_PERIOD_LABELS,
  FINANCE_PERIOD_PRESETS,
} from "@/lib/finance/period";

const PERIOD_OPTIONS: { value: FinancePeriodPreset; label: string }[] =
  FINANCE_PERIOD_PRESETS.map((value) => ({
    value,
    label: FINANCE_PERIOD_LABELS[value],
  }));

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
}) {
  return (
    <Card className="!p-4">
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
    </Card>
  );
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = parseFloat(trimmed.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export default function FinanzuebersichtPage() {
  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<FinancePeriodPreset>("current_month");
  const [presetInitialized, setPresetInitialized] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseDTO | null>(null);
  const [investmentOpen, setInvestmentOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<PlannedInvestmentDTO | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [taxRate, setTaxRate] = useState("30");
  const [revenueBasis, setRevenueBasis] = useState<"ISSUE_DATE" | "PAYMENT_DATE">("ISSUE_DATE");
  const [includeUnpaid, setIncludeUnpaid] = useState(false);
  const [defaultPeriod, setDefaultPeriod] = useState<
    "current_month" | "last_month" | "current_quarter" | "last_quarter" | "current_year"
  >("current_month");
  const [profitTarget, setProfitTarget] = useState("");
  const [highProfitThreshold, setHighProfitThreshold] = useState("5000");
  const [lowLiquidityThreshold, setLowLiquidityThreshold] = useState("");
  const requestIdRef = useRef(0);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ preset });
    if (preset === "custom") {
      if (customFrom) params.set("from", customFrom);
      if (customTo) params.set("to", customTo);
    }
    return params.toString();
  }, [preset, customFrom, customTo]);

  const loadOverview = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    const res = await fetchJson<FinanceOverview>(`/api/finance/overview?${queryString}`);

    if (requestId !== requestIdRef.current) return;

    if (res.success && res.data) {
      setOverview(res.data);
      const s = res.data.settings;
      setTaxRate(String(s.estimatedTaxRate));
      setRevenueBasis(s.revenueBasis);
      setIncludeUnpaid(s.includeUnpaidInvoices);
      setDefaultPeriod(
        s.defaultPeriodPreset === "custom" ? "current_month" : s.defaultPeriodPreset
      );
      setProfitTarget(s.monthlyProfitTargetNet != null ? String(s.monthlyProfitTargetNet) : "");
      setHighProfitThreshold(
        s.highProfitWarningThreshold != null ? String(s.highProfitWarningThreshold) : ""
      );
      setLowLiquidityThreshold(
        s.lowLiquidityWarningThreshold != null ? String(s.lowLiquidityWarningThreshold) : ""
      );
      if (!presetInitialized) {
        setPreset(s.defaultPeriodPreset === "custom" ? "current_month" : s.defaultPeriodPreset);
        setPresetInitialized(true);
      }
      setError(null);
    } else {
      setOverview(null);
      setError(res.error ?? "Daten konnten nicht geladen werden");
    }
    setLoading(false);
  }, [queryString, presetInitialized]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const saveSettings = async () => {
    const rate = parseFloat(taxRate.replace(",", "."));
    if (Number.isNaN(rate) || rate < 0 || rate > 100) return;

    const res = await saveJson(
      "/api/finance/settings",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimatedTaxRate: rate,
          revenueBasis,
          includeUnpaidInvoices: includeUnpaid,
          defaultPeriodPreset: defaultPeriod,
          monthlyProfitTargetNet: parseOptionalNumber(profitTarget),
          highProfitWarningThreshold: parseOptionalNumber(highProfitThreshold),
          lowLiquidityWarningThreshold: parseOptionalNumber(lowLiquidityThreshold),
        }),
      },
      { success: "Finanzprofil gespeichert" }
    );

    if (res.success) {
      setSettingsOpen(false);
      void loadOverview();
    }
  };

  const chartData =
    overview?.expenses.byCategory.map((c) => ({
      name: c.label.length > 18 ? `${c.label.slice(0, 16)}…` : c.label,
      amount: c.amount,
    })) ?? [];

  const openExpenseCreate = () => {
    setEditingExpense(null);
    setExpenseOpen(true);
  };

  const openExpenseEdit = (e: ExpenseDTO) => {
    setEditingExpense(e);
    setExpenseOpen(true);
  };

  const openInvestmentCreate = () => {
    setEditingInvestment(null);
    setInvestmentOpen(true);
  };

  const openInvestmentEdit = (inv: PlannedInvestmentDTO) => {
    setEditingInvestment(inv);
    setInvestmentOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <PiggyBank className="h-7 w-7 text-[#0d5c63]" />
            <h1 className="text-2xl font-bold text-slate-900">Finanzübersicht</h1>
            <InfoButton title="Finanz-Copilot & Steuer-Radar" ariaLabel="Info zur Finanzübersicht">
              <p>{FINANCE_DISCLAIMERS.overview}</p>
              <p>{FINANCE_DISCLAIMERS.taxEstimate}</p>
              <p className="text-xs text-slate-500 mt-2">
                Hinweise sind unverbindlich. Keine automatischen Steuerentscheidungen.
              </p>
            </InfoButton>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Steuer-Radar · Gewinnprognose · unverbindliche Orientierung
          </p>
        </div>
        <CanAccess permission="invoices.write">
          <div className="flex flex-wrap gap-2">
            <Button onClick={openExpenseCreate} className="w-full gap-2 sm:w-auto">
              <Plus className="h-4 w-4" />
              Ausgabe / Beleg
            </Button>
            <Button
              variant="outline"
              onClick={openInvestmentCreate}
              className="w-full gap-2 sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Investition planen
            </Button>
          </div>
        </CanAccess>
      </div>

      <FinanceDisclaimer />

      <Card className="!p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-2">
              <Label>Zeitraum</Label>
              <Select value={preset} onValueChange={(v) => setPreset(v as FinancePeriodPreset)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {preset === "custom" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="from">Von</Label>
                  <Input
                    id="from"
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="to">Bis</Label>
                  <Input
                    id="to"
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          <CanAccess permission="invoices.write">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setSettingsOpen((v) => !v)}
            >
              <Settings2 className="h-4 w-4" />
              Finanzprofil
            </Button>
          </CanAccess>
        </div>

        {settingsOpen && (
          <div className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Finanzprofil</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Alle Werte sind Schätzungen und dienen nur der Orientierung — keine verbindliche
                Steuerberatung.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="tax-rate">Geschätzter Steuersatz (%)</Label>
                <Input
                  id="tax-rate"
                  inputMode="decimal"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Standard-Zeitraum</Label>
                <Select
                  value={defaultPeriod}
                  onValueChange={(v) =>
                    setDefaultPeriod(
                      v as
                        | "current_month"
                        | "last_month"
                        | "current_quarter"
                        | "last_quarter"
                        | "current_year"
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.filter((o) => o.value !== "custom").map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Einnahmen nach</Label>
                <Select
                  value={revenueBasis}
                  onValueChange={(v) => setRevenueBasis(v as typeof revenueBasis)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(REVENUE_BASIS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="profit-target">
                  Zielwert für geplanten Monatsgewinn / steuerliche Orientierung (€)
                </Label>
                <Input
                  id="profit-target"
                  inputMode="decimal"
                  value={profitTarget}
                  onChange={(e) => setProfitTarget(e.target.value)}
                  placeholder="optional, z. B. 4000"
                />
                <p className="text-[11px] text-slate-400">
                  Frühzeitig sehen, wenn der geschätzte Gewinn deutlich höher ist als erwartet.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="high-profit">Warnschwelle hoher Gewinn (€)</Label>
                <Input
                  id="high-profit"
                  inputMode="decimal"
                  value={highProfitThreshold}
                  onChange={(e) => setHighProfitThreshold(e.target.value)}
                  placeholder="z. B. 5000"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="liquidity">Warnschwelle offene Forderungen (€)</Label>
                <Input
                  id="liquidity"
                  inputMode="decimal"
                  value={lowLiquidityThreshold}
                  onChange={(e) => setLowLiquidityThreshold(e.target.value)}
                  placeholder="optional"
                />
              </div>
              <label className="flex items-end gap-2 pb-2 text-sm sm:col-span-2 lg:col-span-1">
                <input
                  type="checkbox"
                  checked={includeUnpaid}
                  onChange={(e) => setIncludeUnpaid(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Unbezahlte Rechnungen einbeziehen
              </label>
            </div>
            <Button size="sm" onClick={saveSettings}>
              Profil speichern
            </Button>
          </div>
        )}

        {overview && (
          <p className="mt-3 text-xs text-slate-500">
            Ausgewerteter Zeitraum: <strong>{overview.period.label}</strong>
            {" · "}
            Einnahmen nach {REVENUE_BASIS_LABELS[overview.revenue.basis]}
            {overview.revenue.includesUnpaid && " · inkl. unbezahlter Rechnungen"}
          </p>
        )}
      </Card>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Finanzübersicht wird geladen…
        </div>
      )}

      {error && !loading && (
        <Card className="border-rose-200 bg-rose-50 !p-4 text-rose-800">{error}</Card>
      )}

      {overview && !loading && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Umsatz / Einnahmen (netto)"
              value={formatEuro(overview.revenue.net)}
              sub={`${overview.revenue.invoiceCount} Rechnung(en) · brutto ${formatEuro(overview.revenue.gross)}`}
              icon={TrendingUp}
              accent="text-emerald-700"
            />
            <KpiCard
              label="Ausgaben (netto)"
              value={formatEuro(overview.expenses.net)}
              sub={`${overview.expenses.count} erfasst · ${overview.expenses.withReceipt} mit Beleg`}
              icon={TrendingDown}
              accent="text-rose-700"
            />
            <KpiCard
              label="Geschätzter Gewinn"
              value={formatEuro(overview.profit.estimatedNet)}
              sub={
                overview.profit.targetNet != null
                  ? `Orientierungsziel ${formatEuro(overview.profit.targetNet)}${
                      overview.profit.targetDelta != null
                        ? ` · Diff. ${formatEuro(overview.profit.targetDelta)}`
                        : ""
                    }`
                  : "Schätzung · Einnahmen minus Ausgaben"
              }
              icon={Calculator}
            />
            <KpiCard
              label="Geschätzte Steuerlast"
              value={formatEuro(overview.tax.estimatedAmount)}
              sub={`${overview.tax.estimatedRate} % · nur Schätzung`}
              icon={Receipt}
              accent="text-amber-700"
            />
          </div>

          {overview.profit.targetNet != null && overview.profit.targetNet > 0 && (
            <Card className="!p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-slate-100 p-2">
                  <Target className="h-4 w-4 text-[#0d5c63]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">
                    Orientierungsziel Monatsgewinn
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Geschätzt {formatEuro(overview.profit.estimatedNet)} von{" "}
                    {formatEuro(overview.profit.targetNet)}
                  </p>
                  <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#0d5c63] transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            (overview.profit.estimatedNet / overview.profit.targetNet) * 100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Unverbindliche Orientierung — keine Steuerentscheidung.
                  </p>
                </div>
              </div>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="!p-4 lg:col-span-2">
              <h2 className="mb-4 text-sm font-semibold text-slate-700">
                Ausgaben nach Kategorie
              </h2>
              {chartData.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Noch keine Ausgaben im gewählten Zeitraum erfasst.
                </p>
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={(v) => `${v} €`} />
                      <Tooltip formatter={(v) => formatEuro(Number(v))} />
                      <Bar dataKey="amount" fill="#0d5c63" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card className="!p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Rechnungen</h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Offen</span>
                  <span className="font-medium">
                    {overview.invoices.openCount} · {formatEuro(overview.invoices.openSum)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-amber-700">
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Überfällig
                  </span>
                  <span className="font-medium">
                    {overview.invoices.overdueCount} · {formatEuro(overview.invoices.overdueSum)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Bezahlt (gesamt)</span>
                  <span>{overview.invoices.paidCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Storniert (gesamt)</span>
                  <span>{overview.invoices.canceledCount}</span>
                </div>
                {overview.inventorySales.count > 0 && (
                  <div className="border-t border-slate-100 pt-2 text-xs text-slate-500">
                    Inventar-Verkäufe/-Weitergaben dokumentiert:{" "}
                    {overview.inventorySales.count}
                    {overview.inventorySales.documentedSaleNet > 0 &&
                      ` · ${formatEuro(overview.inventorySales.documentedSaleNet)}`}
                  </div>
                )}
                <Link
                  href="/dashboard/rechnungen"
                  className="inline-block text-xs text-[#0d5c63] underline-offset-2 hover:underline"
                >
                  Zur Rechnungsübersicht →
                </Link>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <FinanceWarningsPanel warnings={overview.warnings} />

            <Card className="!p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">Belegstatus</h2>
                {overview.expenses.withoutReceipt > 0 && (
                  <Badge variant="outline" className="gap-1 border-amber-300 text-amber-800">
                    <FileWarning className="h-3 w-3" />
                    {overview.expenses.withoutReceipt} ohne Beleg
                  </Badge>
                )}
              </div>
              <div className="space-y-2 text-sm text-slate-600">
                <p>
                  {overview.expenses.withReceipt} von {overview.expenses.count} Ausgaben mit Beleg
                  dokumentiert.
                </p>
                {overview.expenses.byCategory
                  .filter((c) => c.withoutReceipt > 0)
                  .map((c) => (
                    <p key={c.category} className="text-xs text-amber-700">
                      {c.label}: {c.withoutReceipt} ohne Beleg
                    </p>
                  ))}
                <p className="text-[11px] text-slate-400 pt-1">
                  Geplante Investitionen: {overview.plannedInvestments.length}
                </p>
              </div>
            </Card>
          </div>

          <Card className="overflow-x-auto !p-0">
            <div className="border-b border-slate-100 px-4 py-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-700">Letzte Ausgaben & Belege</h2>
              <CanAccess permission="invoices.write">
                <Button size="sm" variant="outline" onClick={openExpenseCreate}>
                  + Beleg
                </Button>
              </CanAccess>
            </div>
            {overview.recentExpenses.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">
                Noch keine Ausgaben erfasst.{" "}
                <CanAccess permission="invoices.write">
                  <button
                    type="button"
                    className="text-[#0d5c63] underline"
                    onClick={openExpenseCreate}
                  >
                    Erste Ausgabe erfassen
                  </button>
                </CanAccess>
              </p>
            ) : (
              <>
                <div className="hidden md:block">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                        <th className="px-4 py-2 font-medium">Datum</th>
                        <th className="px-4 py-2 font-medium">Kategorie</th>
                        <th className="px-4 py-2 font-medium">Beschreibung</th>
                        <th className="px-4 py-2 font-medium text-right">Netto</th>
                        <th className="px-4 py-2 font-medium">Beleg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.recentExpenses.map((e) => (
                        <tr
                          key={e.id}
                          className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer"
                          onClick={() => openExpenseEdit(e)}
                        >
                          <td className="px-4 py-2 whitespace-nowrap">
                            {formatDate(e.expenseDate)}
                          </td>
                          <td className="px-4 py-2">{e.categoryLabel}</td>
                          <td className="px-4 py-2 max-w-[200px] truncate">{e.description}</td>
                          <td className="px-4 py-2 text-right font-medium">
                            {formatEuro(e.netAmount)}
                          </td>
                          <td className="px-4 py-2">
                            {e.hasReceipt ? (
                              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                                Vorhanden
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-amber-300 text-amber-800">
                                Fehlt
                              </Badge>
                            )}
                            {e.isInvestment && (
                              <Badge variant="outline" className="ml-1 text-xs">
                                Investition
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="md:hidden divide-y divide-slate-50">
                  {overview.recentExpenses.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className="w-full text-left p-4 hover:bg-slate-50"
                      onClick={() => openExpenseEdit(e)}
                    >
                      <div className="flex justify-between gap-2">
                        <p className="font-medium text-sm">{e.description}</p>
                        <p className="text-sm font-semibold shrink-0">
                          {formatEuro(e.netAmount)}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatDate(e.expenseDate)} · {e.categoryLabel}
                        {e.hasReceipt ? " · Beleg ✓" : " · Beleg fehlt"}
                      </p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </Card>

          <Card className="!p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-700">Geplante Investitionen</h2>
              <CanAccess permission="invoices.write">
                <Button size="sm" variant="outline" onClick={openInvestmentCreate}>
                  + Planen
                </Button>
              </CanAccess>
            </div>
            {overview.plannedInvestments.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                Noch keine geplanten Investitionen.
              </p>
            ) : (
              <div className="space-y-2">
                {overview.plannedInvestments.map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => openInvestmentEdit(inv)}
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

          <FinanceDisclaimer compact />

          <Card className="border-dashed !p-4 text-center text-sm text-slate-500">
            Export für Steuerberater (CSV/PDF/ZIP) ist für eine spätere Version geplant.
          </Card>
        </>
      )}

      <ExpenseFormDialog
        open={expenseOpen}
        onOpenChange={(open) => {
          setExpenseOpen(open);
          if (!open) setEditingExpense(null);
        }}
        onSaved={loadOverview}
        expense={editingExpense}
      />
      <InvestmentFormDialog
        open={investmentOpen}
        onOpenChange={(open) => {
          setInvestmentOpen(open);
          if (!open) setEditingInvestment(null);
        }}
        onSaved={loadOverview}
        investment={editingInvestment}
      />
    </div>
  );
}
