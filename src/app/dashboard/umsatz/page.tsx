"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  addMonths,
  endOfMonth,
  format,
  startOfMonth,
} from "date-fns";
import { de } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Euro,
  FileWarning,
  Loader2,
  Receipt,
  TrendingUp,
  Ban,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
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
import { AmountModeToggle } from "@/components/finance/amount-mode-toggle";
import { fetchJson } from "@/lib/fetch-json";
import { formatDate, formatEuro, cn } from "@/lib/utils";
import {
  amountModeLabel,
  pickAmount,
  useAmountMode,
} from "@/lib/amount-mode";
import {
  FINANCE_PERIOD_LABELS,
  FINANCE_PERIOD_PRESETS,
  parseMonthInputValue,
  resolveFinancePeriod,
  toMonthInputValue,
} from "@/lib/finance/period";
import { REVENUE_BASIS_LABELS, type FinancePeriodPreset } from "@/lib/finance/types";
import type { RevenueMonthHistoryRow, RevenueOverview, RevenueOrderRow } from "@/lib/revenue/types";

const PERIOD_OPTIONS = FINANCE_PERIOD_PRESETS.map((value) => ({
  value,
  label: FINANCE_PERIOD_LABELS[value],
}));

const INVOICE_STATUS_STYLES: Record<string, string> = {
  OFFEN: "bg-amber-100 text-amber-800",
  TEILBEZAHLT: "bg-blue-100 text-blue-800",
  BEZAHLT: "bg-emerald-100 text-emerald-800",
  STORNIERT: "bg-rose-100 text-rose-800",
  GEMISCHT: "bg-slate-100 text-slate-700",
  KEINE: "bg-slate-100 text-slate-500",
  ENTWURF: "bg-slate-100 text-slate-700",
};

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

function MonthHistoryRow({
  row,
  mode,
  active,
  onSelect,
}: {
  row: RevenueMonthHistoryRow;
  mode: "gross" | "net";
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <tr
      className={cn(
        "cursor-pointer border-b border-slate-50 transition-colors last:border-0 hover:bg-slate-50",
        active && "bg-[#0d5c63]/5"
      )}
      onClick={onSelect}
    >
      <td className="px-3 py-2.5 font-medium capitalize text-slate-900">{row.label}</td>
      <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
        {formatEuro(pickAmount(mode, { net: row.revenueNet, gross: row.revenueGross }))}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
        {formatEuro(row.vat)}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">{row.invoiceCount}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{row.orderCount}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
        {formatEuro(pickAmount(mode, { net: row.paidNet, gross: row.paidGross }))}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">
        {formatEuro(pickAmount(mode, { net: row.openNet, gross: row.openGross }))}
      </td>
    </tr>
  );
}

function OrderRow({
  row,
  mode,
}: {
  row: RevenueOrderRow;
  mode: "gross" | "net";
}) {
  const primary = pickAmount(mode, { net: row.netAmount, gross: row.grossAmount });
  const secondary =
    mode === "gross"
      ? `Netto ${formatEuro(row.netAmount)}`
      : `Brutto ${formatEuro(row.grossAmount)}`;
  const openPrimary =
    mode === "gross"
      ? row.openAmount
      : row.grossAmount > 0
        ? row.netAmount * (row.openAmount / row.grossAmount)
        : 0;
  const paidPrimary =
    mode === "gross"
      ? row.paidAmount
      : row.grossAmount > 0
        ? row.netAmount * (row.paidAmount / row.grossAmount)
        : 0;

  return (
    <Link
      href={row.href}
      className="block border-b border-slate-100 px-3 py-3 transition-colors last:border-0 hover:bg-slate-50 sm:px-4"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-slate-900 truncate">
              {row.orderNumber ? `${row.orderNumber} · ` : ""}
              {row.title}
            </p>
            {row.orderStatusLabel && (
              <Badge variant="secondary" className="text-[10px]">
                {row.orderStatusLabel}
              </Badge>
            )}
            <Badge
              className={cn(
                "text-[10px] border-0",
                INVOICE_STATUS_STYLES[row.invoiceStatus] ?? "bg-slate-100 text-slate-700"
              )}
            >
              {row.invoiceStatusLabel}
            </Badge>
          </div>
          <p className="text-sm text-slate-600">{row.customerName}</p>
          <p className="text-xs text-slate-400">
            {formatDate(row.date)}
            {row.invoiceCount > 1 ? ` · ${row.invoiceCount} Rechnungen` : ""}
          </p>
        </div>
        <div className="shrink-0 text-left sm:text-right space-y-0.5">
          <p className="text-base font-semibold text-slate-900">{formatEuro(primary)}</p>
          <p className="text-xs text-slate-500">{secondary}</p>
          <p className="text-xs text-slate-500">
            Bezahlt {formatEuro(paidPrimary)} · Offen {formatEuro(openPrimary)}
          </p>
        </div>
      </div>
    </Link>
  );
}

export default function UmsatzuebersichtPage() {
  const [mode, setMode] = useAmountMode();
  const [overview, setOverview] = useState<RevenueOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<FinancePeriodPreset>("current_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const requestIdRef = useRef(0);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ preset });
    if (preset === "custom") {
      if (customFrom) params.set("from", customFrom);
      if (customTo) params.set("to", customTo);
    }
    return params.toString();
  }, [preset, customFrom, customTo]);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    const res = await fetchJson<RevenueOverview>(`/api/revenue/overview?${queryString}`);
    if (requestId !== requestIdRef.current) return;
    if (res.success && res.data) {
      setOverview(res.data);
      setError(null);
      if (res.data.period.isSingleMonth) {
        setMonthCursor(startOfMonth(new Date(res.data.period.from)));
      }
    } else {
      setOverview(null);
      setError(res.error ?? "Daten konnten nicht geladen werden");
    }
    setLoading(false);
  }, [queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  const goToMonth = (date: Date) => {
    const from = startOfMonth(date);
    const to = endOfMonth(date);
    setMonthCursor(from);
    setPreset("custom");
    setCustomFrom(format(from, "yyyy-MM-dd"));
    setCustomTo(format(to, "yyyy-MM-dd"));
  };

  const goPrevMonth = () => goToMonth(addMonths(monthCursor, -1));
  const goNextMonth = () => goToMonth(addMonths(monthCursor, 1));
  const goCurrentMonth = () => {
    setPreset("current_month");
    setCustomFrom("");
    setCustomTo("");
    setMonthCursor(startOfMonth(new Date()));
  };

  const onPresetChange = (value: FinancePeriodPreset) => {
    setPreset(value);
    if (value === "custom") {
      const period = resolveFinancePeriod("current_month");
      setCustomFrom(format(period.from, "yyyy-MM-dd"));
      setCustomTo(format(period.to, "yyyy-MM-dd"));
      setMonthCursor(startOfMonth(period.from));
      return;
    }
    if (value === "current_month" || value === "last_month") {
      const period = resolveFinancePeriod(value);
      setMonthCursor(startOfMonth(period.from));
    }
    setCustomFrom("");
    setCustomTo("");
  };

  const showMonthNav =
    preset === "current_month" ||
    preset === "last_month" ||
    (preset === "custom" && (overview?.period.isSingleMonth ?? true));

  const monthLabel = format(monthCursor, "MMMM yyyy", { locale: de });
  const isCurrentMonthView =
    format(monthCursor, "yyyy-MM") === format(new Date(), "yyyy-MM") &&
    (preset === "current_month" ||
      (preset === "custom" && overview?.period.isSingleMonth));

  const primaryTotal = overview
    ? pickAmount(mode, { net: overview.totals.net, gross: overview.totals.gross })
    : 0;
  const secondaryTotal = overview
    ? mode === "gross"
      ? overview.totals.net
      : overview.totals.gross
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Euro className="h-7 w-7 text-[#0d5c63]" />
            <h1 className="text-2xl font-bold text-slate-900">Umsatzübersicht</h1>
            <InfoButton title="Umsatzübersicht" ariaLabel="Info zur Umsatzübersicht">
              <p>
                Umsatz aus Rechnungen im gewählten Zeitraum. Stornierte Rechnungen zählen
                nicht zum Umsatz und werden separat ausgewiesen.
              </p>
              <p className="mt-2">
                Brutto/Netto ist nur eine Anzeigeoption — gespeicherte Rechnungsdaten werden
                nicht verändert.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Die Umschaltung gilt auch in der Rechnungsübersicht.
              </p>
            </InfoButton>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Monatsnavigation · Zeitraumfilter · Monatshistorie · Aufträge
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <AmountModeToggle mode={mode} onChange={setMode} />
          <p className="text-[11px] text-slate-400">Nur Anzeige · keine Datenänderung</p>
        </div>
      </div>

      <Card className="!p-4 space-y-4">
        {showMonthNav && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={goPrevMonth}
                aria-label="Vorheriger Monat"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-[9.5rem] text-center">
                <p className="text-base font-semibold capitalize text-slate-900">{monthLabel}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={goNextMonth}
                aria-label="Nächster Monat"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="month"
                className="w-auto"
                value={toMonthInputValue(monthCursor)}
                onChange={(e) => {
                  const period = parseMonthInputValue(e.target.value);
                  if (period) goToMonth(period.from);
                }}
                aria-label="Monat wählen"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={goCurrentMonth}
                disabled={Boolean(isCurrentMonthView)}
              >
                Aktueller Monat
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-2">
            <Label>Zeitraum</Label>
            <Select
              value={preset}
              onValueChange={(v) => onPresetChange(v as FinancePeriodPreset)}
            >
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
                <Label htmlFor="rev-from">Von</Label>
                <Input
                  id="rev-from"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rev-to">Bis</Label>
                <Input
                  id="rev-to"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {overview && (
          <p className="text-xs text-slate-500">
            Ausgewertet: <strong>{overview.period.label}</strong>
            {" · "}
            Einnahmen nach {REVENUE_BASIS_LABELS[overview.settings.revenueBasis]}
            {overview.settings.includeUnpaidInvoices && " · inkl. unbezahlter Rechnungen"}
            {" · "}
            Ansicht {amountModeLabel(mode)}
          </p>
        )}
      </Card>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Umsatzübersicht wird geladen…
        </div>
      )}

      {error && !loading && (
        <Card className="border-rose-200 bg-rose-50 !p-4 text-rose-800">{error}</Card>
      )}

      {overview && !loading && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label={`Gesamtumsatz (${amountModeLabel(mode).toLowerCase()})`}
              value={formatEuro(primaryTotal)}
              sub={`${overview.totals.invoiceCount} Rechnung(en) · ${
                mode === "gross" ? "netto" : "brutto"
              } ${formatEuro(secondaryTotal)}`}
              icon={TrendingUp}
              accent="text-emerald-700"
            />
            <KpiCard
              label="Umsatzsteuer"
              value={formatEuro(overview.totals.vat)}
              sub="im Umsatzzeitraum"
              icon={Receipt}
            />
            <KpiCard
              label={`Offene Rechnungen (${amountModeLabel(mode).toLowerCase()})`}
              value={formatEuro(
                pickAmount(mode, {
                  net: overview.invoices.openSumNet,
                  gross: overview.invoices.openSumGross,
                })
              )}
              sub={`${overview.invoices.openCount} offen`}
              icon={FileWarning}
              accent="text-amber-700"
            />
            <KpiCard
              label={`Bezahlte Rechnungen (${amountModeLabel(mode).toLowerCase()})`}
              value={formatEuro(
                pickAmount(mode, {
                  net: overview.invoices.paidSumNet,
                  gross: overview.invoices.paidSumGross,
                })
              )}
              sub={`${overview.invoices.paidCount} bezahlt`}
              icon={CheckCircle2}
              accent="text-emerald-700"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card className="!p-4">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                <p className="text-sm font-semibold">Überfällig</p>
              </div>
              <p className="mt-2 text-xl font-bold text-amber-800">
                {formatEuro(
                  pickAmount(mode, {
                    net: overview.invoices.overdueSumNet,
                    gross: overview.invoices.overdueSumGross,
                  })
                )}
              </p>
              <p className="text-xs text-slate-500">
                {overview.invoices.overdueCount} Rechnung(en)
              </p>
            </Card>
            <Card className="!p-4">
              <div className="flex items-center gap-2 text-rose-800">
                <Ban className="h-4 w-4" />
                <p className="text-sm font-semibold">Storniert (separat)</p>
              </div>
              <p className="mt-2 text-xl font-bold text-rose-800">
                {formatEuro(
                  pickAmount(mode, {
                    net: overview.invoices.canceledSumNet,
                    gross: overview.invoices.canceledSumGross,
                  })
                )}
              </p>
              <p className="text-xs text-slate-500">
                {overview.invoices.canceledCount} Rechnung(en) · nicht im Umsatz enthalten
              </p>
            </Card>
          </div>

          {(overview.monthHistory ?? []).length > 0 && (
            <Card className="!p-0 overflow-hidden">
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-800">Monatshistorie</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Tippe auf einen Monat, um ihn zu öffnen · Werte in{" "}
                  {amountModeLabel(mode).toLowerCase()}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
                      <th className="px-3 py-2">Monat</th>
                      <th className="px-3 py-2 text-right">Umsatz</th>
                      <th className="px-3 py-2 text-right">USt</th>
                      <th className="px-3 py-2 text-right">Rechnungen</th>
                      <th className="px-3 py-2 text-right">Aufträge</th>
                      <th className="px-3 py-2 text-right">Bezahlt</th>
                      <th className="px-3 py-2 text-right">Offen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(overview.monthHistory ?? []).map((row) => (
                      <MonthHistoryRow
                        key={row.key}
                        row={row}
                        mode={mode}
                        active={
                          overview.period.isSingleMonth &&
                          toMonthInputValue(new Date(overview.period.from)) === row.key
                        }
                        onSelect={() =>
                          goToMonth(new Date(row.year, row.monthIndex, 1))
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card className="!p-0 overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-800">
                Aufträge im Zeitraum
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Aufträge mit Rechnungen im ausgewählten Zeitraum — Tippen öffnet den Auftrag
              </p>
            </div>
            {overview.orders.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                Keine Aufträge mit Rechnungen in diesem Zeitraum.
              </p>
            ) : (
              <div className="divide-y-0">
                {overview.orders.map((row) => (
                  <OrderRow
                    key={row.orderId ?? row.primaryInvoiceId ?? row.title + row.date}
                    row={row}
                    mode={mode}
                  />
                ))}
              </div>
            )}
          </Card>

          <p className="text-xs text-slate-400">
            Detailansicht Finanz-Copilot:{" "}
            <Link href="/dashboard/finanzuebersicht" className="text-[#0d5c63] hover:underline">
              Finanzübersicht
            </Link>
            {" · "}
            <Link href="/dashboard/rechnungen" className="text-[#0d5c63] hover:underline">
              Alle Rechnungen
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
