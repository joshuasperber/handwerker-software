import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

export async function GET() {
  const auth = await requireAuth("calculations.read");
  if (auth instanceof Response) return auth;

  const [company, overhead] = await Promise.all([
    prisma.companySettings.findUnique({ where: { tenantId: auth.tenantId } }),
    prisma.overheadSettings.findUnique({ where: { tenantId: auth.tenantId } }),
  ]);

  return apiSuccess({ company, overhead });
}

export async function PUT(request: Request) {
  const auth = await requireAuth("calculations.settings");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const { company, overhead } = body;

  let companyRecord = await prisma.companySettings.findUnique({
    where: { tenantId: auth.tenantId },
  });

  if (company) {
    const data = {
      companyName: company.companyName ?? "Mein Betrieb",
      street: company.street,
      houseNumber: company.houseNumber,
      postalCode: company.postalCode,
      city: company.city,
      country: company.country ?? "DE",
      defaultVatRate: company.defaultVatRate != null ? Number(company.defaultVatRate) : undefined,
      defaultHourlyRate: company.defaultHourlyRate != null ? Number(company.defaultHourlyRate) : undefined,
      defaultWorkshopHourlyRate:
        company.defaultWorkshopHourlyRate != null ? Number(company.defaultWorkshopHourlyRate) : undefined,
      defaultMaterialMarkupPercent:
        company.defaultMaterialMarkupPercent != null
          ? Number(company.defaultMaterialMarkupPercent)
          : undefined,
      defaultProcurementHourlyRate:
        company.defaultProcurementHourlyRate != null
          ? Number(company.defaultProcurementHourlyRate)
          : undefined,
      defaultRiskPercent: company.defaultRiskPercent != null ? Number(company.defaultRiskPercent) : undefined,
      defaultProfitPercent:
        company.defaultProfitPercent != null ? Number(company.defaultProfitPercent) : undefined,
      defaultIncomeTaxPercent:
        company.defaultIncomeTaxPercent != null ? Number(company.defaultIncomeTaxPercent) : undefined,
      defaultKilometerRate:
        company.defaultKilometerRate != null ? Number(company.defaultKilometerRate) : undefined,
      defaultTravelHourlyRate:
        company.defaultTravelHourlyRate != null ? Number(company.defaultTravelHourlyRate) : undefined,
      defaultOverheadPercent:
        company.defaultOverheadPercent != null ? Number(company.defaultOverheadPercent) : undefined,
      additionalOverheadPercent:
        company.additionalOverheadPercent != null
          ? Number(company.additionalOverheadPercent)
          : undefined,
    };

    companyRecord = companyRecord
      ? await prisma.companySettings.update({
          where: { tenantId: auth.tenantId },
          data,
        })
      : await prisma.companySettings.create({
          data: { tenantId: auth.tenantId, ...data },
        });
  }

  let overheadRecord = await prisma.overheadSettings.findUnique({
    where: { tenantId: auth.tenantId },
  });

  if (overhead) {
    const overheadData = {
      productiveHoursPerMonth:
        overhead.productiveHoursPerMonth != null
          ? Number(overhead.productiveHoursPerMonth)
          : undefined,
      overheadCalculationMode: overhead.overheadCalculationMode,
      overheadPercent: overhead.overheadPercent != null ? Number(overhead.overheadPercent) : undefined,
    };

    overheadRecord = overheadRecord
      ? await prisma.overheadSettings.update({
          where: { tenantId: auth.tenantId },
          data: overheadData,
        })
      : await prisma.overheadSettings.create({
          data: { tenantId: auth.tenantId, ...overheadData },
        });
  }

  if (!companyRecord && !overheadRecord) {
    return apiError("Keine Daten zum Speichern", 400);
  }

  return apiSuccess({ company: companyRecord, overhead: overheadRecord });
}
