"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
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
import { FinancePeriodFilter } from "@/components/finance/finance-period-filter";
import { FinanceCockpitOverview } from "@/components/finance/finance-cockpit-overview";
import { ExpenseFormDialog } from "@/components/finance/expense-form-dialog";
import { InvestmentFormDialog } from "@/components/finance/investment-form-dialog";
import { ExpensesPanel } from "@/components/finance/expenses-panel";
import { InvestmentsPanel } from "@/components/finance/investments-panel";
import { saveJson } from "@/lib/save-toast";
import { swrKeys, useApiSWR } from "@/lib/swr";
import {
  FINANCE_DISCLAIMERS,
  REVENUE_BASIS_LABELS,
  type ExpenseDTO,
  type FinanceOverview,
  type FinancePeriodPreset,
  type PlannedInvestmentDTO,
} from "@/lib/finance/types";
import { Plus, Settings2, PiggyBank, Loader2, Download } from "lucide-react";

import {
  FINANCE_PERIOD_LABELS,
  FINANCE_PERIOD_PRESETS,
  isSingleMonthPeriod,
  shiftMonthPeriod,
  parseLocalDateInput,
} from "@/lib/finance/period";

const PERIOD_OPTIONS: { value: FinancePeriodPreset; label: string }[] =
  FINANCE_PERIOD_PRESETS.map((value) => ({
    value,
    label: FINANCE_PERIOD_LABELS[value],
  }));

type FinanceView = "ausgaben" | "investitionen" | null;

function parseView(value: string | null): FinanceView {
  if (value === "ausgaben" || value === "investitionen") return value;
  return null;
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = parseFloat(trimmed.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function FinanzuebersichtContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = parseView(searchParams.get("view"));

  const setView = useCallback(
    (next: FinanceView) => {
      if (!next) {
        router.push("/dashboard/finanzuebersicht", { scroll: false });
        return;
      }
      router.push(`/dashboard/finanzuebersicht?view=${next}`, { scroll: false });
    },
    [router]
  );

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
  const [reservePercent, setReservePercent] = useState("");
  const [revenueBasis, setRevenueBasis] = useState<"ISSUE_DATE" | "PAYMENT_DATE">("ISSUE_DATE");
  const [includeUnpaid, setIncludeUnpaid] = useState(false);
  const [defaultPeriod, setDefaultPeriod] = useState<
    "current_month" | "last_month" | "current_quarter" | "last_quarter" | "current_year"
  >("current_month");
  const [profitTarget, setProfitTarget] = useState("");
  const [highProfitThreshold, setHighProfitThreshold] = useState("5000");
  const [lowLiquidityThreshold, setLowLiquidityThreshold] = useState("");
  const [vatRegistered, setVatRegistered] = useState(true);
  const [kleinunternehmer, setKleinunternehmer] = useState(false);
  const [hasTaxAdvisor, setHasTaxAdvisor] = useState(false);
  const [profileNote, setProfileNote] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ preset });
    if (preset === "custom") {
      if (customFrom) params.set("from", customFrom);
      if (customTo) params.set("to", customTo);
    }
    return params.toString();
  }, [preset, customFrom, customTo]);

  const {
    data: overview,
    error: swrError,
    isLoading,
    isValidating,
    mutate,
  } = useApiSWR<FinanceOverview>(swrKeys.financeOverview(queryString), {
    dedupingInterval: 3_000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  const loading = isLoading && !overview;
  const error = swrError
    ? swrError instanceof Error
      ? swrError.message
      : "Daten konnten nicht geladen werden"
    : null;

  const syncSettingsFromOverview = useCallback((s: FinanceOverview["settings"]) => {
    setTaxRate(String(s.estimatedTaxRate));
    setReservePercent(s.reservePercent != null ? String(s.reservePercent) : "");
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
    setVatRegistered(s.vatRegistered !== false);
    setKleinunternehmer(Boolean(s.kleinunternehmer));
    setHasTaxAdvisor(Boolean(s.hasTaxAdvisor));
    setProfileNote(s.profileNote ?? "");
  }, []);

  useEffect(() => {
    if (!overview || presetInitialized) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Einmalige Übernahme serverseitiger Einstellungen in den editierbaren Formularzustand.
    syncSettingsFromOverview(overview.settings);
    setPreset(
      overview.settings.defaultPeriodPreset === "custom"
        ? "current_month"
        : overview.settings.defaultPeriodPreset
    );
    setPresetInitialized(true);
  }, [overview, presetInitialized, syncSettingsFromOverview]);

  const refreshOverview = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const saveSettings = async () => {
    const rate = parseFloat(taxRate.replace(",", "."));
    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      return;
    }
    const reserve = parseOptionalNumber(reservePercent);

    const res = await saveJson(
      "/api/finance/settings",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimatedTaxRate: rate,
          reservePercent: reserve,
          revenueBasis,
          includeUnpaidInvoices: includeUnpaid,
          defaultPeriodPreset: defaultPeriod,
          monthlyProfitTargetNet: parseOptionalNumber(profitTarget),
          highProfitWarningThreshold: parseOptionalNumber(highProfitThreshold),
          lowLiquidityWarningThreshold: parseOptionalNumber(lowLiquidityThreshold),
          vatRegistered,
          kleinunternehmer,
          hasTaxAdvisor,
          profileNote: profileNote.trim() || null,
        }),
      },
      { success: "Finanzprofil gespeichert" }
    );

    if (res.success) {
      setSettingsOpen(false);
      await mutate();
    }
  };

  const shiftMonth = (delta: number) => {
    const ref = overview
      ? parseLocalDateInput(overview.period.from.slice(0, 10))
      : new Date();
    const next = shiftMonthPeriod(ref, delta);
    setPreset("custom");
    setCustomFrom(
      `${next.from.getFullYear()}-${String(next.from.getMonth() + 1).padStart(2, "0")}-01`
    );
    const last = next.to;
    setCustomTo(
      `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`
    );
  };

  const exportHref = useMemo(() => {
    const params = new URLSearchParams({ preset, section: "all" });
    if (preset === "custom") {
      if (customFrom) params.set("from", customFrom);
      if (customTo) params.set("to", customTo);
    }
    return `/api/finance/export?${params.toString()}`;
  }, [preset, customFrom, customTo]);

  const canNavigateMonths = (() => {
    if (preset === "current_month" || preset === "last_month") return true;
    if (preset !== "custom") return false;
    if (customFrom && customTo) {
      return isSingleMonthPeriod(
        parseLocalDateInput(customFrom),
        parseLocalDateInput(customTo)
      );
    }
    if (overview) {
      return isSingleMonthPeriod(
        parseLocalDateInput(overview.period.from.slice(0, 10)),
        parseLocalDateInput(overview.period.to.slice(0, 10))
      );
    }
    return false;
  })();

  const openExpenseCreate = () => {
    setEditingExpense(null);
    setExpenseOpen(true);
  };

  const openInvestmentCreate = () => {
    setEditingInvestment(null);
    setInvestmentOpen(true);
  };

  if (view === "ausgaben") {
    return (
      <ExpensesPanel
        onBack={() => setView(null)}
        onChanged={refreshOverview}
      />
    );
  }

  if (view === "investitionen") {
    return (
      <InvestmentsPanel
        onBack={() => setView(null)}
        onChanged={refreshOverview}
      />
    );
  }

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
          {isValidating && overview ? (
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              aktualisiert…
            </p>
          ) : null}
        </div>
        <CanAccess permission="invoices.write">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={openExpenseCreate}
              className="w-full gap-2 sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Ausgaben erfassen
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
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Zeitraum
              </p>
              <FinancePeriodFilter
                preset={preset}
                onPresetChange={(next) => setPreset(next)}
                customFrom={customFrom}
                customTo={customTo}
                onCustomFrom={setCustomFrom}
                onCustomTo={setCustomTo}
                canNavigateMonths={canNavigateMonths}
                onShiftMonth={shiftMonth}
                periodLabel={overview?.period.label}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm" className="gap-2">
                <a href={exportHref}>
                  <Download className="h-4 w-4" />
                  CSV-Export
                </a>
              </Button>
              <CanAccess permission="invoices.write">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    setSettingsOpen((v) => {
                      const next = !v;
                      if (next && overview) syncSettingsFromOverview(overview.settings);
                      return next;
                    });
                  }}
                >
                  <Settings2 className="h-4 w-4" />
                  Finanzprofil
                </Button>
              </CanAccess>
            </div>
          </div>
          {overview && (
            <p className="text-xs text-slate-500">
              Einnahmen nach {REVENUE_BASIS_LABELS[overview.revenue.basis]}
              {overview.revenue.includesUnpaid && " · inkl. unbezahlter Rechnungen"}
            </p>
          )}
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
                  placeholder="z. B. 30"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reserve-pct">Rücklagenprozentsatz (%)</Label>
                <Input
                  id="reserve-pct"
                  inputMode="decimal"
                  value={reservePercent}
                  onChange={(e) => setReservePercent(e.target.value)}
                  placeholder="leer = wie Steuersatz"
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
                Unbezahlte Rechnungen in die Umsatzschätzung einbeziehen
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={vatRegistered}
                  onChange={(e) => setVatRegistered(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Umsatzsteuerpflicht (Orientierung)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={kleinunternehmer}
                  onChange={(e) => setKleinunternehmer(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Kleinunternehmerregelung (Orientierung)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hasTaxAdvisor}
                  onChange={(e) => setHasTaxAdvisor(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Steuerberater vorhanden
              </label>
              <div className="grid gap-2 sm:col-span-2 lg:col-span-3">
                <Label htmlFor="profile-note">Notiz zum Finanzprofil</Label>
                <Input
                  id="profile-note"
                  value={profileNote}
                  onChange={(e) => setProfileNote(e.target.value)}
                  placeholder="optional"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              {FINANCE_DISCLAIMERS.taxEstimate}
            </p>
            <Button size="sm" onClick={() => void saveSettings()}>
              Profil speichern
            </Button>
          </div>
        )}
      </Card>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Finanzübersicht wird geladen…
        </div>
      )}

      {error && !loading && !overview && (
        <Card className="border-rose-200 bg-rose-50 !p-4 text-rose-800">{error}</Card>
      )}

      {overview && (
        <>
          <FinanceCockpitOverview
            overview={overview}
            onOpenExpense={(expense) => {
              setEditingExpense(expense ?? null);
              setExpenseOpen(true);
            }}
            onOpenInvestment={(investment) => {
              setEditingInvestment(investment ?? null);
              setInvestmentOpen(true);
            }}
            onViewAusgaben={() => setView("ausgaben")}
            onViewInvestitionen={() => setView("investitionen")}
          />

          <FinanceDisclaimer compact />


          <Card className="!p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-700">Export für Steuerberater</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  CSV mit Ausgaben, Investitionen und Rechnungen im gewählten Zeitraum. Kein
                  automatischer Versand an Dritte.
                </p>
              </div>
              <Button asChild variant="outline" className="gap-2 shrink-0">
                <a href={exportHref}>
                  <Download className="h-4 w-4" />
                  CSV herunterladen
                </a>
              </Button>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              {FINANCE_DISCLAIMERS.overview} PDF/ZIP mit Belegen und DATEV sind für eine spätere
              Version vorgesehen.
            </p>
          </Card>
        </>
      )}

      <ExpenseFormDialog
        open={expenseOpen}
        onOpenChange={(open) => {
          setExpenseOpen(open);
          if (!open) setEditingExpense(null);
        }}
        onSaved={refreshOverview}
        expense={editingExpense}
      />
      <InvestmentFormDialog
        open={investmentOpen}
        onOpenChange={(open) => {
          setInvestmentOpen(open);
          if (!open) setEditingInvestment(null);
        }}
        onSaved={refreshOverview}
        investment={editingInvestment}
      />
    </div>
  );
}

export default function FinanzuebersichtPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Finanzübersicht wird geladen…
        </div>
      }
    >
      <FinanzuebersichtContent />
    </Suspense>
  );
}
