import { prisma } from "@/lib/prisma";
import { Prisma, type FinanceRevenueBasis } from "@/generated/prisma/client";
import type { FinancePeriodPreset, FinanceSettingsDTO } from "./types";

const PERIOD_PRESETS: FinancePeriodPreset[] = [
  "current_month",
  "last_month",
  "current_quarter",
  "last_quarter",
  "current_year",
];

const SETTINGS_DEFAULTS: FinanceSettingsDTO = {
  estimatedTaxRate: 30,
  revenueBasis: "ISSUE_DATE",
  includeUnpaidInvoices: false,
  defaultPeriodPreset: "current_month",
  monthlyProfitTargetNet: null,
  highProfitWarningThreshold: 5000,
  profitSpikeFactor: 1.5,
  lowExpenseRatioThreshold: 0.15,
  highRevenueThreshold: 3000,
  lowLiquidityWarningThreshold: null,
};

function normalizePeriodPreset(value: string | null | undefined): FinancePeriodPreset {
  if (value && (PERIOD_PRESETS as string[]).includes(value)) {
    return value as FinancePeriodPreset;
  }
  return "current_month";
}

function toFinanceSettingsDTO(settings: Record<string, unknown>): FinanceSettingsDTO {
  return {
    estimatedTaxRate:
      typeof settings.estimatedTaxRate === "number"
        ? settings.estimatedTaxRate
        : SETTINGS_DEFAULTS.estimatedTaxRate,
    revenueBasis:
      settings.revenueBasis === "PAYMENT_DATE" || settings.revenueBasis === "ISSUE_DATE"
        ? settings.revenueBasis
        : SETTINGS_DEFAULTS.revenueBasis,
    includeUnpaidInvoices: Boolean(
      settings.includeUnpaidInvoices ?? SETTINGS_DEFAULTS.includeUnpaidInvoices
    ),
    defaultPeriodPreset: normalizePeriodPreset(
      typeof settings.defaultPeriodPreset === "string"
        ? settings.defaultPeriodPreset
        : undefined
    ),
    monthlyProfitTargetNet:
      typeof settings.monthlyProfitTargetNet === "number"
        ? settings.monthlyProfitTargetNet
        : null,
    highProfitWarningThreshold:
      typeof settings.highProfitWarningThreshold === "number"
        ? settings.highProfitWarningThreshold
        : SETTINGS_DEFAULTS.highProfitWarningThreshold,
    profitSpikeFactor:
      typeof settings.profitSpikeFactor === "number"
        ? settings.profitSpikeFactor
        : SETTINGS_DEFAULTS.profitSpikeFactor,
    lowExpenseRatioThreshold:
      typeof settings.lowExpenseRatioThreshold === "number"
        ? settings.lowExpenseRatioThreshold
        : SETTINGS_DEFAULTS.lowExpenseRatioThreshold,
    highRevenueThreshold:
      typeof settings.highRevenueThreshold === "number"
        ? settings.highRevenueThreshold
        : SETTINGS_DEFAULTS.highRevenueThreshold,
    lowLiquidityWarningThreshold:
      typeof settings.lowLiquidityWarningThreshold === "number"
        ? settings.lowLiquidityWarningThreshold
        : null,
  };
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

function isMissingColumnError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("does not exist") ||
    msg.includes("Unknown argument") ||
    msg.includes("Unknown field") ||
    (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2022")
  );
}

/**
 * Lädt oder legt Finanzeinstellungen an. Race-safe: parallele Requests
 * können bei upsert auf tenantId kollidieren (P2002) — daher find/create/retry.
 * Fehlt die Profil-Migration, werden sichere Defaults genutzt.
 */
export async function getOrCreateFinanceSettings(
  tenantId: string
): Promise<FinanceSettingsDTO> {
  try {
    const existing = await prisma.financeSettings.findUnique({
      where: { tenantId },
    });
    if (existing) return toFinanceSettingsDTO(existing);

    const company = await prisma.companySettings.findUnique({
      where: { tenantId },
      select: { defaultIncomeTaxPercent: true },
    });

    try {
      const created = await prisma.financeSettings.create({
        data: {
          tenantId,
          ...(company?.defaultIncomeTaxPercent != null
            ? { estimatedTaxRate: company.defaultIncomeTaxPercent }
            : {}),
        },
      });
      return toFinanceSettingsDTO(created);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        const settings = await prisma.financeSettings.findUniqueOrThrow({
          where: { tenantId },
        });
        return toFinanceSettingsDTO(settings);
      }
      throw err;
    }
  } catch (err) {
    if (isMissingColumnError(err)) {
      console.warn(
        "[finance] FinanceSettings-Schema unvollständig — Defaults werden genutzt. Migration ausführen.",
        err instanceof Error ? err.message : err
      );
      // Minimal-Fallback: alte Spalten lesen, falls möglich
      try {
        const rows = await prisma.$queryRaw<
          Array<{
            estimatedTaxRate: number;
            revenueBasis: FinanceRevenueBasis;
            includeUnpaidInvoices: boolean;
          }>
        >`SELECT "estimatedTaxRate", "revenueBasis", "includeUnpaidInvoices"
          FROM "FinanceSettings" WHERE "tenantId" = ${tenantId} LIMIT 1`;
        if (rows[0]) return toFinanceSettingsDTO(rows[0]);
      } catch {
        /* ignore */
      }
      return { ...SETTINGS_DEFAULTS };
    }
    throw err;
  }
}

export type FinanceSettingsUpdate = Partial<{
  estimatedTaxRate: number;
  revenueBasis: FinanceRevenueBasis;
  includeUnpaidInvoices: boolean;
  defaultPeriodPreset: FinancePeriodPreset;
  monthlyProfitTargetNet: number | null;
  highProfitWarningThreshold: number | null;
  profitSpikeFactor: number;
  lowExpenseRatioThreshold: number;
  highRevenueThreshold: number;
  lowLiquidityWarningThreshold: number | null;
}>;

export async function updateFinanceSettings(
  tenantId: string,
  data: FinanceSettingsUpdate
): Promise<FinanceSettingsDTO> {
  try {
    const existing = await prisma.financeSettings.findUnique({
      where: { tenantId },
    });

    if (existing) {
      const updated = await prisma.financeSettings.update({
        where: { tenantId },
        data,
      });
      return toFinanceSettingsDTO(updated);
    }

    try {
      const created = await prisma.financeSettings.create({
        data: { tenantId, ...data },
      });
      return toFinanceSettingsDTO(created);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        const updated = await prisma.financeSettings.update({
          where: { tenantId },
          data,
        });
        return toFinanceSettingsDTO(updated);
      }
      throw err;
    }
  } catch (err) {
    if (isMissingColumnError(err)) {
      // Nur bekannte Basis-Felder speichern, wenn Profil-Migration fehlt
      const baseData: {
        estimatedTaxRate?: number;
        revenueBasis?: FinanceRevenueBasis;
        includeUnpaidInvoices?: boolean;
      } = {};
      if (data.estimatedTaxRate != null) baseData.estimatedTaxRate = data.estimatedTaxRate;
      if (data.revenueBasis != null) baseData.revenueBasis = data.revenueBasis;
      if (data.includeUnpaidInvoices != null) {
        baseData.includeUnpaidInvoices = data.includeUnpaidInvoices;
      }

      const existing = await prisma.financeSettings.findUnique({ where: { tenantId } });
      if (existing) {
        const updated = await prisma.financeSettings.update({
          where: { tenantId },
          data: baseData,
        });
        return toFinanceSettingsDTO({ ...toFinanceSettingsDTO(updated), ...data });
      }
      const created = await prisma.financeSettings.create({
        data: { tenantId, ...baseData },
      });
      return toFinanceSettingsDTO({ ...toFinanceSettingsDTO(created), ...data });
    }
    throw err;
  }
}
