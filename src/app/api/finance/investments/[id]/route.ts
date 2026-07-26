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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("invoices.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const existing = await prisma.plannedInvestment.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!existing) return apiError("Investition nicht gefunden", 404);

  const body = await request.json();
  const parsed = investmentInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  }

  const data = parsed.data;
  const item = await prisma.plannedInvestment.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.plannedAmount !== undefined && { plannedAmount: data.plannedAmount }),
      ...(data.plannedDate !== undefined && {
        plannedDate: data.plannedDate ? new Date(data.plannedDate) : null,
      }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.note !== undefined && { note: data.note }),
      ...(data.status !== undefined && { status: data.status }),
    },
  });

  return apiSuccess(toInvestmentDTO(item));
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("invoices.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const existing = await prisma.plannedInvestment.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!existing) return apiError("Investition nicht gefunden", 404);

  await prisma.plannedInvestment.delete({ where: { id } });
  return apiSuccess({ deleted: true });
}
