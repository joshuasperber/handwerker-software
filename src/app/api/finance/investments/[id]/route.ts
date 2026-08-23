import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError, NO_STORE_HEADERS } from "@/lib/api";
import { investmentInputSchema } from "@/lib/finance/schemas";
import { INVESTMENT_INCLUDE, toInvestmentDTO } from "@/lib/finance/investment-dto";
import { resolveInvestmentLinks } from "@/lib/finance/investment-links";

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
  const links =
    data.machineId !== undefined || data.articleId !== undefined || data.projectId !== undefined
      ? await resolveInvestmentLinks(auth.tenantId, {
          machineId: data.machineId !== undefined ? data.machineId : existing.machineId,
          articleId: data.articleId !== undefined ? data.articleId : existing.articleId,
          projectId: data.projectId !== undefined ? data.projectId : existing.projectId,
        })
      : null;
  if (links && "error" in links) return apiError(links.error);

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
      ...(links && {
        machineId: links.machineId,
        articleId: links.articleId,
        projectId: links.projectId,
      }),
    },
    include: INVESTMENT_INCLUDE,
  });

  return apiSuccess(toInvestmentDTO(item), 200, NO_STORE_HEADERS);
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
  return apiSuccess({ deleted: true }, 200, NO_STORE_HEADERS);
}
