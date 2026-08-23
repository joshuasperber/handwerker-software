import {
  INVESTMENT_CATEGORY_LABELS,
  INVESTMENT_STATUS_LABELS,
  type PlannedInvestmentDTO,
} from "./types";
import type {
  PlannedInvestmentCategory,
  PlannedInvestmentStatus,
} from "@/generated/prisma/client";

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
  machine?: { id: string; name: string } | null;
  article?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
};

export const INVESTMENT_INCLUDE = {
  machine: { select: { id: true, name: true } },
  article: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
} as const;

export function toInvestmentDTO(inv: InvestmentRecord): PlannedInvestmentDTO {
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
  };
}
