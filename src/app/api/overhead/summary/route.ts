import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";
import { calcOverhead } from "@/lib/calculation/formulas";

export async function GET(request: Request) {
  const auth = await requireAuth("calculations.read");
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const billableHours = Number(searchParams.get("billableHours") ?? 0);
  const directCosts = Number(searchParams.get("directCosts") ?? 0);

  const [fixedCosts, overheadSettings, company] = await Promise.all([
    prisma.monthlyFixedCost.aggregate({
      where: { tenantId: auth.tenantId, isActive: true },
      _sum: { amountNet: true },
    }),
    prisma.overheadSettings.findUnique({ where: { tenantId: auth.tenantId } }),
    prisma.companySettings.findUnique({ where: { tenantId: auth.tenantId } }),
  ]);

  const monthlyTotal = fixedCosts._sum.amountNet ?? 0;
  const productiveHours = overheadSettings?.productiveHoursPerMonth ?? 160;
  const mode = overheadSettings?.overheadCalculationMode ?? "HYBRID";

  const overhead = calcOverhead({
    mode: mode as "PERCENTAGE" | "HOURLY_ALLOCATION" | "HYBRID",
    monthlyFixedCostsTotal: monthlyTotal,
    productiveHoursPerMonth: productiveHours,
    totalBillableHours: billableHours,
    directCosts,
    overheadPercent: overheadSettings?.overheadPercent ?? company?.defaultOverheadPercent ?? undefined,
    additionalOverheadPercent: company?.additionalOverheadPercent ?? 0,
  });

  return apiSuccess({
    monthlyFixedCostsTotal: monthlyTotal,
    productiveHoursPerMonth: productiveHours,
    overheadCalculationMode: mode,
    overheadHourlyRate: overhead.hourlyRate,
    overheadAmountForJob: overhead.amount,
    explanation: `Ihre monatlichen Fixkosten betragen ${monthlyTotal.toFixed(2)} €. Bei ${productiveHours} produktiven Stunden ergibt das ${overhead.hourlyRate.toFixed(2)} € Gemeinkosten pro produktiver Stunde.`,
  });
}
