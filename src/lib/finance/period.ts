import {
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  subQuarters,
  subMonths,
  addMonths,
  startOfYear,
  endOfYear,
  format,
  isSameMonth,
} from "date-fns";
import { de } from "date-fns/locale";
import type { FinancePeriodPreset } from "./types";

export interface FinancePeriod {
  preset: FinancePeriodPreset;
  from: Date;
  to: Date;
  label: string;
}

export const FINANCE_PERIOD_PRESETS: FinancePeriodPreset[] = [
  "current_month",
  "last_month",
  "current_quarter",
  "last_quarter",
  "current_year",
  "custom",
];

export const FINANCE_PERIOD_LABELS: Record<FinancePeriodPreset, string> = {
  current_month: "Aktueller Monat",
  last_month: "Letzter Monat",
  current_quarter: "Aktuelles Quartal",
  last_quarter: "Letztes Quartal",
  current_year: "Aktuelles Jahr",
  custom: "Freier Zeitraum",
};

function monthLabel(date: Date) {
  return format(date, "MMMM yyyy", { locale: de });
}

function quarterLabel(date: Date) {
  return `Q${Math.ceil((date.getMonth() + 1) / 3)} ${date.getFullYear()}`;
}

/** Parst `yyyy-MM-dd` als lokales Datum (ohne UTC-Verschiebung). */
export function parseLocalDateInput(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(value);
}

/** Zeitraum für einen konkreten Kalendermonat (z. B. Monatsnavigation). */
export function resolveMonthPeriod(year: number, monthIndex: number): FinancePeriod {
  const ref = new Date(year, monthIndex, 1);
  return {
    preset: "custom",
    from: startOfMonth(ref),
    to: endOfMonth(ref),
    label: monthLabel(ref),
  };
}

export function resolveFinancePeriod(
  preset: FinancePeriodPreset,
  customFrom?: string | null,
  customTo?: string | null,
  now = new Date()
): FinancePeriod {
  switch (preset) {
    case "current_month":
      return {
        preset,
        from: startOfMonth(now),
        to: endOfMonth(now),
        label: monthLabel(now),
      };
    case "last_month": {
      const ref = subMonths(now, 1);
      return {
        preset,
        from: startOfMonth(ref),
        to: endOfMonth(ref),
        label: monthLabel(ref),
      };
    }
    case "current_quarter":
      return {
        preset,
        from: startOfQuarter(now),
        to: endOfQuarter(now),
        label: quarterLabel(now),
      };
    case "last_quarter": {
      const ref = subQuarters(now, 1);
      return {
        preset,
        from: startOfQuarter(ref),
        to: endOfQuarter(ref),
        label: quarterLabel(ref),
      };
    }
    case "current_year":
      return {
        preset,
        from: startOfYear(now),
        to: endOfYear(now),
        label: `${now.getFullYear()}`,
      };
    case "custom": {
      const from = customFrom ? parseLocalDateInput(customFrom) : startOfMonth(now);
      let to = customTo ? parseLocalDateInput(customTo) : endOfMonth(now);
      // Wenn nur ein Tagesdatum gewählt wurde, bis Tagesende rechnen
      if (customTo && /^\d{4}-\d{2}-\d{2}$/.test(customTo.trim())) {
        to = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);
      }
      return {
        preset,
        from,
        to,
        label: isSingleMonthPeriod(from, to)
          ? monthLabel(from)
          : `${format(from, "dd.MM.yyyy")} – ${format(to, "dd.MM.yyyy")}`,
      };
    }
  }
}

/** Verschiebt einen Monatszeitraum um `delta` Monate (für Prev/Next). */
export function shiftMonthPeriod(from: Date, delta: number): FinancePeriod {
  const ref = addMonths(startOfMonth(from), delta);
  return resolveMonthPeriod(ref.getFullYear(), ref.getMonth());
}

export function toMonthInputValue(date: Date): string {
  return format(startOfMonth(date), "yyyy-MM");
}

export function parseMonthInputValue(value: string): FinancePeriod | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (!Number.isFinite(year) || month < 0 || month > 11) return null;
  return resolveMonthPeriod(year, month);
}

/** True, wenn von/bis denselben Kalendermonat abdecken (Tag 1 bis Monatsende). */
export function isSingleMonthPeriod(from: Date, to: Date): boolean {
  if (!isSameMonth(from, to)) return false;
  return from.getDate() === 1 && to.getDate() === endOfMonth(from).getDate();
}
