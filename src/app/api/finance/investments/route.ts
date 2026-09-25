import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError, NO_STORE_HEADERS } from "@/lib/api";
import { investmentInputSchema } from "@/lib/finance/schemas";
import { INVESTMENT_INCLUDE } from "@/lib/finance/investment-dto";
import { enrichInvestments } from "@/lib/finance/investment-planning";
import { resolveInvestmentLinks } from "@/lib/finance/investment-links";

export async function GET() {
  const auth = await requireAuth("invoices.read");
  if (auth instanceof Response) return auth;

  const items = await prisma.plannedInvestment.findMany({
    where: { tenantId: auth.tenantId },
    include: INVESTMENT_INCLUDE,
    orderBy: [{ status: "asc" }, { plannedDate: "asc" }],
  });

  const enriched = await enrichInvestments(auth.tenantId, items);
  return apiSuccess(enriched, 200, NO_STORE_HEADERS);
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
  const links = await resolveInvestmentLinks(auth.tenantId, data);
  if ("error" in links) return apiError(links.error);

  const item = await prisma.plannedInvestment.create({
    data: {
      tenantId: auth.tenantId,
      title: data.title,
      plannedAmount: data.plannedAmount,
      plannedDate: data.plannedDate ? new Date(data.plannedDate) : null,
      category: data.category,
      note: data.note ?? null,
      status: data.status,
      savedAmount: data.savedAmount ?? 0,
      startDate: data.startDate ? new Date(data.startDate) : null,
      savingsModel: data.savingsModel,
      percentOfRevenue: data.percentOfRevenue ?? null,
      amountPerOrder: data.amountPerOrder ?? null,
      monthlyAmount: data.monthlyAmount ?? null,
      calculationBasis: data.calculationBasis,
      machineId: links.machineId,
      articleId: links.articleId,
      projectId: links.projectId,
    },
    include: INVESTMENT_INCLUDE,
  });

  const [dto] = await enrichInvestments(auth.tenantId, [item]);
  return apiSuccess(dto, 201, NO_STORE_HEADERS);
}
