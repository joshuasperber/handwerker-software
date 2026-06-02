import { prisma } from "@/lib/prisma";
import { recalculateCalculationRecord } from "@/lib/calculation/recalculate-db";

export async function createCalculationFromOrder(tenantId: string, orderId: string) {
  const existing = await prisma.calculation.findFirst({
    where: { tenantId, orderId },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) return { calculation: existing, created: false };

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId },
    include: {
      customer: true,
      property: true,
      services: { include: { service: true } },
      materialLines: { include: { article: true } },
    },
  });
  if (!order) throw new Error("Auftrag nicht gefunden");

  const [company, overhead] = await Promise.all([
    prisma.companySettings.findUnique({ where: { tenantId } }),
    prisma.overheadSettings.findUnique({ where: { tenantId } }),
  ]);

  const defaultRate = company?.defaultHourlyRate ?? 68;
  const markup = company?.defaultMaterialMarkupPercent ?? 25;
  const kmRate = company?.defaultKilometerRate ?? 0.45;
  const travelRate = company?.defaultTravelHourlyRate ?? 45;

  const laborCreates =
    order.services.length > 0
      ? order.services.map((os) => ({
          description: os.service.name,
          laborType: "ONSITE_WORK" as const,
          hours: Math.max(os.service.durationMinutes / 60, 0.25),
          hourlyRateNet: defaultRate,
          quantityWorkers: 1,
        }))
      : [
          {
            description: order.title ?? order.orderNumber,
            laborType: "ONSITE_WORK" as const,
            hours: 2,
            hourlyRateNet: defaultRate,
            quantityWorkers: 1,
          },
        ];

  const materialCreates = order.materialLines
    .filter((l) => !l.isTool)
    .map((line) => ({
      name: line.name,
      quantity: line.quantityRequired,
      unit: line.unit,
      purchasePriceNet: line.article?.purchasePriceNet ?? 0,
      markupPercent: markup,
    }));

  const startAddress = company
    ? [company.street, company.houseNumber, company.postalCode, company.city].filter(Boolean).join(" ")
    : "Betrieb";

  const destinationAddress = `${order.property.street}, ${order.property.zipCode} ${order.property.city}`;

  const calc = await prisma.calculation.create({
    data: {
      tenantId,
      orderId: order.id,
      customerId: order.customerId,
      title: `Kalkulation ${order.orderNumber}`,
      laborItems: { create: laborCreates },
      ...(materialCreates.length ? { materialItems: { create: materialCreates } } : {}),
      travelCost: {
        create: {
          startAddress: startAddress || "Betrieb",
          destinationAddress,
          distanceKm: 15,
          estimatedDriveTimeHours: 0.5,
          kilometerRateNet: kmRate,
          travelHourlyRateNet: travelRate,
          calculationMode: "FORMULA",
        },
      },
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
  });

  await recalculateCalculationRecord(calc.id, tenantId);
  const full = await prisma.calculation.findUnique({ where: { id: calc.id } });
  return { calculation: full!, created: true };
}
