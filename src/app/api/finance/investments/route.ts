import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { investmentInputSchema } from "@/lib/finance/schemas";
import {
  INVESTMENT_CATEGORY_LABELS,
  INVESTMENT_STATUS_LABELS,
  type PlannedInvestmentDTO,
} from "@/lib/finance/types";

function toInvestmentDTO(inv: {
  id: string;
  title: string;
  plannedAmount: number;
  plannedDate: Date | null;
  category: keyof typeof INVESTMENT_CATEGORY_LABELS;
  note: string | null;
  status: keyof typeof INVESTMENT_STATUS_LABELS;
  createdAt: Date;
}): PlannedInvestmentDTO {
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
    createdAt: inv.createdAt.toISOString(),
  };
}

export async function GET() {
  const auth = await requireAuth("invoices.read");
  if (auth instanceof Response) return auth;

  const items = await prisma.plannedInvestment.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: [{ status: "asc" }, { plannedDate: "asc" }],
  });

  return apiSuccess(items.map(toInvestmentDTO));
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("invoices.write");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const parsed = investmentInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  }

  const data = parsed.data;
  const item = await prisma.plannedInvestment.create({
    data: {
      tenantId: auth.tenantId,
      title: data.title,
      plannedAmount: data.plannedAmount,
      plannedDate: data.plannedDate ? new Date(data.plannedDate) : null,
      category: data.category,
      note: data.note ?? null,
      status: data.status,
    },
  });

  return apiSuccess(toInvestmentDTO(item), 201);
}
