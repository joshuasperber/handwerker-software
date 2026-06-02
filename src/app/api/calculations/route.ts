import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("calculations.read");
  if (auth instanceof Response) return auth;

  const calculations = await prisma.calculation.findMany({
    where: {
      tenantId: auth.tenantId,
      OR: [
        { directCosts: { gt: 0 } },
        { totalBillableHours: { gt: 0 } },
        { laborItems: { some: {} } },
        { materialItems: { some: {} } },
        { machineUsages: { some: {} } },
        { status: { not: "DRAFT" } },
      ],
    },
    include: {
      customer: { select: { firstName: true, lastName: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return apiSuccess(calculations);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("calculations.write");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const { title, customerId, orderId } = body;

  const company = await prisma.companySettings.findUnique({
    where: { tenantId: auth.tenantId },
  });

  const overhead = await prisma.overheadSettings.findUnique({
    where: { tenantId: auth.tenantId },
  });

  const calc = await prisma.calculation.create({
    data: {
      tenantId: auth.tenantId,
      title: title ?? "Neue Kalkulation",
      customerId: customerId ?? undefined,
      orderId: orderId ?? undefined,
      riskSettings: {
        create: {
          riskLevel: "NORMAL",
          riskPercent: company?.defaultRiskPercent ?? 7,
        },
      },
      profitSettings: {
        create: {
          profitPercent: company?.defaultProfitPercent ?? 12,
          profitStrategy: "PERCENT",
        },
      },
      incomeTaxSettings: {
        create: {
          estimatedIncomeTaxPercent: company?.defaultIncomeTaxPercent ?? 30,
          productiveHoursPerMonth: overhead?.productiveHoursPerMonth ?? 160,
          allocationMode: "PROFIT_CHECK_ONLY",
        },
      },
      vatSettings: {
        create: {
          vatRatePercent: company?.defaultVatRate ?? 19,
        },
      },
    },
    include: {
      riskSettings: true,
      profitSettings: true,
      incomeTaxSettings: true,
      vatSettings: true,
    },
  });

  return apiSuccess(calc, 201);
}
