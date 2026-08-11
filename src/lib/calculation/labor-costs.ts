import { calcLaborCost, calcWorkedHours } from "@/lib/time-entry";
import { calcLaborItemTotal, roundMoney } from "@/lib/calculation/formulas";

export type LaborInvoiceMode = "INTERNAL" | "ITEMIZED" | "SUMMARIZED";

export const LABOR_INVOICE_MODES: {
  value: LaborInvoiceMode;
  label: string;
  description: string;
}[] = [
  {
    value: "INTERNAL",
    label: "Nur intern",
    description: "Arbeitszeit bleibt in der Kalkulation – nicht auf Angebot/Rechnung",
  },
  {
    value: "ITEMIZED",
    label: "Einzelpositionen",
    description: "Jede Mitarbeiter-/Arbeitszeile einzeln ausweisen",
  },
  {
    value: "SUMMARIZED",
    label: "Zusammengefasst",
    description: "Alle Arbeitsstunden als eine Position",
  },
];

export function resolveLaborInvoiceMode(mode?: string | null): LaborInvoiceMode {
  if (mode === "INTERNAL" || mode === "ITEMIZED" || mode === "SUMMARIZED") return mode;
  return "ITEMIZED";
}

export type LaborCostLine = {
  description: string;
  hours: number;
  actualHours: number | null;
  hourlyRateNet: number;
  internalHourlyWageNet: number | null;
  quantityWorkers: number;
  totalNet: number;
  isVisibleToCustomer: boolean;
  employeeId?: string | null;
  employeeName?: string | null;
  notes?: string | null;
};

/** Verkaufspreis der Arbeitsposition (geplante Stunden × Verrechnungssatz). */
export function calcLaborBillingTotal(line: {
  hours: number;
  hourlyRateNet: number;
  quantityWorkers?: number;
}): number {
  return calcLaborItemTotal(line.hours, line.hourlyRateNet, line.quantityWorkers ?? 1);
}

/** Interne Kosten: (Ist-Stunden oder geplant) × interner Lohn. */
export function calcLaborInternalCost(line: {
  hours: number;
  actualHours?: number | null;
  internalHourlyWageNet?: number | null;
  quantityWorkers?: number;
}): number | null {
  const hours =
    line.actualHours != null && Number.isFinite(line.actualHours)
      ? Number(line.actualHours)
      : Number(line.hours) || 0;
  const wage = line.internalHourlyWageNet;
  if (wage == null || !Number.isFinite(wage)) return null;
  return calcLaborCost(hours * (line.quantityWorkers ?? 1), wage);
}

export function summarizeLaborCostLines(lines: LaborCostLine[]) {
  let plannedHours = 0;
  let actualHours = 0;
  let hasActual = false;
  let billingTotal = 0;
  let internalTotal = 0;
  let hasInternal = false;

  for (const line of lines) {
    const workers = line.quantityWorkers || 1;
    plannedHours += (Number(line.hours) || 0) * workers;
    if (line.actualHours != null && Number.isFinite(line.actualHours)) {
      actualHours += Number(line.actualHours) * workers;
      hasActual = true;
    }
    billingTotal += line.totalNet || calcLaborBillingTotal(line);
    const internal = calcLaborInternalCost(line);
    if (internal != null) {
      internalTotal += internal;
      hasInternal = true;
    }
  }

  const planned = roundMoney(plannedHours);
  const actual = hasActual ? roundMoney(actualHours) : null;

  let plannedInternal: number | null = null;
  if (hasInternal) {
    let sum = 0;
    let ok = true;
    for (const line of lines) {
      const c = calcLaborInternalCost({
        hours: line.hours,
        actualHours: null,
        internalHourlyWageNet: line.internalHourlyWageNet,
        quantityWorkers: line.quantityWorkers,
      });
      if (c == null) {
        ok = false;
        break;
      }
      sum += c;
    }
    plannedInternal = ok ? roundMoney(sum) : null;
  }

  return {
    plannedHours: planned,
    actualHours: actual,
    deltaHours: actual != null ? roundMoney(actual - planned) : null,
    billingTotal: roundMoney(billingTotal),
    internalTotal: hasInternal ? roundMoney(internalTotal) : null,
    costDelta:
      hasInternal && plannedInternal != null
        ? roundMoney(internalTotal - plannedInternal)
        : null,
  };
}

export function formatLaborDocumentLabel(line: {
  description: string;
  hours?: number;
  employeeName?: string | null;
}): string {
  const hours = Number(line.hours) || 0;
  const hoursPart = hours > 0 ? ` – ${hours.toLocaleString("de-DE", { maximumFractionDigits: 2 })} Std.` : "";
  if (line.employeeName?.trim()) {
    return `${line.description.trim() || "Arbeitszeit"} (${line.employeeName.trim()})${hoursPart}`;
  }
  return `${line.description.trim() || "Arbeitszeit"}${hoursPart}`;
}

/**
 * Kundensichtbare Arbeitszeilen je nach Modus.
 * Bei Festpreis wird Arbeitszeit ohnehin über Festpreis-Logik gesteuert.
 */
export function buildLaborCustomerLines(
  mode: LaborInvoiceMode | string | null | undefined,
  laborItems: Array<{
    description: string;
    hours?: number;
    totalNet: number;
    isVisibleToCustomer: boolean;
    employeeName?: string | null;
  }>,
  options?: { useFixedPrice?: boolean }
): Array<{ label: string; amount: number }> {
  if (options?.useFixedPrice) return [];

  const resolved = resolveLaborInvoiceMode(mode);
  if (resolved === "INTERNAL") return [];

  const visible = laborItems.filter((l) => l.isVisibleToCustomer !== false);
  if (!visible.length) return [];

  if (resolved === "SUMMARIZED") {
    const hours = visible.reduce((s, l) => s + (Number(l.hours) || 0), 0);
    const amount = roundMoney(visible.reduce((s, l) => s + (Number(l.totalNet) || 0), 0));
    return [
      {
        label: `Montagearbeiten – ${hours.toLocaleString("de-DE", { maximumFractionDigits: 2 })} Std.`,
        amount,
      },
    ];
  }

  return visible.map((l) => ({
    label: formatLaborDocumentLabel(l),
    amount: Number(l.totalNet) || 0,
  }));
}

/** Baut LaborItems aus Stundenzettel-Aggregation (pro Mitarbeiter). */
export function laborItemsFromTimeSummary(
  byEmployee: Array<{
    employeeId: string;
    name: string;
    hours: number;
    hourlyWageNet: number | null;
  }>,
  defaults: {
    billingHourlyRateNet: number;
    billingRatesByEmployee?: Record<string, number | null | undefined>;
    defaultActivity?: string;
  }
): Array<{
  employeeId: string;
  description: string;
  hours: number;
  actualHours: number;
  hourlyRateNet: number;
  internalHourlyWageNet: number | null;
  quantityWorkers: number;
  isVisibleToCustomer: boolean;
  notes: string | null;
  laborType: "ONSITE_WORK";
}> {
  return byEmployee
    .filter((row) => row.hours > 0)
    .map((row) => {
      const billing =
        defaults.billingRatesByEmployee?.[row.employeeId] ?? defaults.billingHourlyRateNet;
      return {
        employeeId: row.employeeId,
        description: defaults.defaultActivity?.trim() || `Arbeitszeit ${row.name}`,
        hours: row.hours,
        actualHours: row.hours,
        hourlyRateNet: Number(billing) || defaults.billingHourlyRateNet,
        internalHourlyWageNet: row.hourlyWageNet,
        quantityWorkers: 1,
        isVisibleToCustomer: true,
        notes: "Aus Stundenzettel übernommen",
        laborType: "ONSITE_WORK" as const,
      };
    });
}

export { calcWorkedHours };
