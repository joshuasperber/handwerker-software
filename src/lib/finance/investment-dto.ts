import {
  INVESTMENT_CATEGORY_LABELS,
  INVESTMENT_STATUS_LABELS,
  type PlannedInvestmentDTO,
} from "./types";
import {
  CALCULATION_BASIS_LABELS,
  SAVINGS_MODEL_LABELS,
  potSummary,
  type InvestmentCalculationBasis,
  type InvestmentSavingsModel,
} from "./investment-reserve";
import type { PlannedInvestmentCategory, PlannedInvestmentStatus } from "@/generated/prisma/client";

export type InvestmentRecord = {
  id: string;
  title: string;
  plannedAmount: number;
  plannedDate: Date | null;
  category: PlannedInvestmentCategory;
  note: string | null;
  status: PlannedInvestmentStatus;
  machineId?: string | null;
  articleId?: string | null;
  projectId?: string | null;
  createdAt: Date;
  savedAmount?: number;
  startDate?: Date | null;
  savingsModel?: InvestmentSavingsModel;
  percentOfRevenue?: number | null;
  amountPerOrder?: number | null;
  monthlyAmount?: number | null;
  calculationBasis?: InvestmentCalculationBasis;
  machine?: { id: string; name: string } | null;
  article?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
};

export const INVESTMENT_INCLUDE = {
  machine: { select: { id: true, name: true } },
  article: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
} as const;

export function toInvestmentDTO(
  inv: InvestmentRecord,
  extras?: {
    monthSuggestion?: number | null;
    monthSuggestionLabel?: string | null;
    suggestionExplanation?: string | null;
    hints?: string[];
  }
): PlannedInvestmentDTO {
  const model = inv.savingsModel ?? "TARGET_SCHEDULE";
  const basis = inv.calculationBasis ?? "NET";
  const pot = potSummary(inv.plannedAmount, inv.savedAmount ?? 0);
  return {
    id: inv.id,
    title: inv.title,
    plannedAmount: inv.plannedAmount,
    plannedDate: inv.plannedDate?.toISOString() ?? null,
    category: inv.category,
    categoryLabel: INVESTMENT_CATEGORY_LABELS[inv.category],
    note: inv.note,
    status: inv.status,
    statusLabel: INVESTMENT_STATUS_LABELS[inv.status],
    machineId: inv.machineId ?? inv.machine?.id ?? null,
    machineName: inv.machine?.name ?? null,
    articleId: inv.articleId ?? inv.article?.id ?? null,
    articleName: inv.article?.name ?? null,
    projectId: inv.projectId ?? inv.project?.id ?? null,
    projectName: inv.project?.name ?? null,
    createdAt: inv.createdAt.toISOString(),
    savedAmount: pot.saved,
    remainingAmount: pot.remaining,
    progressPercent: pot.progressPercent,
    startDate: inv.startDate?.toISOString() ?? null,
    savingsModel: model,
    savingsModelLabel: SAVINGS_MODEL_LABELS[model],
    percentOfRevenue: inv.percentOfRevenue ?? null,
    amountPerOrder: inv.amountPerOrder ?? null,
    monthlyAmount: inv.monthlyAmount ?? null,
    calculationBasis: basis,
    calculationBasisLabel: CALCULATION_BASIS_LABELS[basis],
    monthSuggestion: extras?.monthSuggestion ?? null,
    monthSuggestionLabel: extras?.monthSuggestionLabel ?? null,
    suggestionExplanation: extras?.suggestionExplanation ?? null,
    hints: extras?.hints ?? [],
  };
}
